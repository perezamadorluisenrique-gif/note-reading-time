import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, debounce, setTooltip } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';

import {
  DEFAULT_OPTIONS,
  countText,
  fillTemplate,
  formatDuration,
  formatNumber,
  fromLegacy,
  propertyMinutes,
  readingSeconds,
} from './src/reading.ts';
import type { Counts, DurationStyle, LegacySettings, ReadingOptions } from './src/reading.ts';

interface NoteReadingTimeSettings extends ReadingOptions {
  showStatusBar: boolean;
  durationStyle: DurationStyle;
  /** `{time}` stands for the duration. */
  template: string;
  selectionTemplate: string;
  /** The note property the "save to properties" commands write, in minutes. */
  propertyName: string;
  /** Set once the settings of Reading Time have been offered. */
  legacyChecked: boolean;
}

const DEFAULT_SETTINGS: NoteReadingTimeSettings = {
  ...DEFAULT_OPTIONS,
  showStatusBar: true,
  durationStyle: 'short',
  template: '{time} read',
  selectionTemplate: '{time} (selection)',
  propertyName: 'reading-time',
  legacyChecked: false,
};

/** Where Reading Time keeps its settings, relative to the config folder. */
const LEGACY_DATA = 'plugins/obsidian-reading-time/data.json';

const STYLES: Record<DurationStyle, string> = {
  short: '5 min, 1 h 5 min',
  precise: '5 min 30 s',
  clock: '5:30',
};

/** Names and descriptions shared by the 1.13+ declarative tab and the older `display()`. */
const TEXT = {
  showStatusBar: { name: 'Show in the status bar', desc: 'Desktop only. The commands work everywhere, mobile included.' },
  wpm: { name: 'Reading speed', desc: 'Words per minute. Adults read about 230 on screen; slow down for study, speed up for skimming.' },
  cjkPerMinute: {
    name: 'Chinese, Japanese and Korean speed',
    desc: 'Characters per minute for these scripts, which have no spaces to count words by.',
  },
  secondsPerImage: { name: 'Seconds per image', desc: 'Time added for each embedded image. 0 leaves images out.' },
  includeCode: { name: 'Count code blocks', desc: 'Off by default: code is skimmed, not read like prose.' },
  durationStyle: { name: 'Time format', desc: 'How the duration is written.' },
  template: { name: 'Status bar text', desc: 'Use {time} for the duration, for example "{time} read" or "Reading: {time}".' },
  selectionTemplate: { name: 'Text for a selection', desc: 'Shown instead when you select text. Use {time} for the duration.' },
  propertyName: {
    name: 'Property name',
    desc: 'The note property that the "save to properties" commands fill in with the minutes, so you can sort or query notes by it.',
  },
  legacy: { name: 'Import from Reading Time', desc: 'Copy the reading speed and text of the original plugin, if it is installed in this vault.' },
};

export default class NoteReadingTimePlugin extends Plugin {
  settings: NoteReadingTimeSettings = { ...DEFAULT_SETTINGS };
  private statusEl: HTMLElement | null = null;
  /** What the status bar shows now, for the click. */
  private current: { counts: Counts; seconds: number; selection: boolean } | null = null;

  private scheduleUpdate = debounce(() => this.update(), 400, true);
  private scheduleSelection = debounce(() => this.update(), 120, true);

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new NoteReadingTimeSettingTab(this.app, this));

    this.addCommand({
      id: 'show',
      name: 'Show the reading time of this note or selection',
      icon: 'clock',
      callback: () => this.showDetails(),
    });
    this.addCommand({
      id: 'save-property',
      name: 'Save the reading time to this note’s properties',
      icon: 'file-clock',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || file.extension !== 'md') return false;
        if (!checking) void this.saveProperty(file, true);
        return true;
      },
    });
    this.addCommand({
      id: 'save-property-all',
      name: 'Save the reading time to the properties of every note',
      icon: 'library',
      callback: () => new ConfirmAllModal(this.app, this).open(),
    });

    this.registerEvent(this.app.workspace.on('file-open', () => this.update()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.update()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.update()));
    this.registerEvent(this.app.workspace.on('editor-change', () => this.scheduleUpdate()));
    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file === this.app.workspace.getActiveFile()) this.scheduleUpdate();
    }));
    this.registerDomEvent(document, 'selectionchange', () => this.scheduleSelection());

    this.app.workspace.onLayoutReady(() => {
      this.applyStatusBar();
      this.update();
      void this.offerLegacyImport();
    });
  }

  onunload() {
    this.statusEl?.remove();
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<NoteReadingTimeSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyStatusBar();
    this.update();
  }

  private applyStatusBar() {
    if (!this.settings.showStatusBar) {
      this.statusEl?.remove();
      this.statusEl = null;
      return;
    }
    if (this.statusEl) return;
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('note-reading-time', 'mod-clickable');
    this.statusEl.addEventListener('click', () => this.showDetails());
  }

  /** The selected text of the active note, in the editor or in reading view. */
  private selectedText(view: MarkdownView): string {
    if (view.getMode() === 'source') return view.editor.getSelection();
    const selection = view.containerEl.win.getSelection();
    if (!selection || selection.isCollapsed || !selection.anchorNode || !view.contentEl.contains(selection.anchorNode)) return '';
    return selection.toString();
  }

  private measure(view: MarkdownView): { counts: Counts; seconds: number; selection: boolean } {
    const selected = this.selectedText(view);
    const selection = selected.trim().length > 0;
    const counts = countText(selection ? selected : view.getViewData(), this.settings.includeCode);
    return { counts, seconds: readingSeconds(counts, this.settings), selection };
  }

  update() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      // The file explorer or a sidebar took focus: keep what a note showed. Nothing to show once no note is open.
      if (this.app.workspace.getLeavesOfType('markdown').length === 0) this.clear();
      return;
    }
    this.current = this.measure(view);
    if (!this.statusEl) return;
    const time = formatDuration(this.current.seconds, this.settings.durationStyle);
    this.statusEl.setText(fillTemplate(this.current.selection ? this.settings.selectionTemplate : this.settings.template, time));
    setTooltip(this.statusEl, this.describe(this.current.counts, this.current.seconds, this.current.selection), { placement: 'top' });
  }

  private clear() {
    this.current = null;
    this.statusEl?.setText('');
  }

  private describe(counts: Counts, seconds: number, selection: boolean): string {
    const parts: string[] = [];
    if (counts.words > 0 || counts.cjk === 0) parts.push(`${formatNumber(counts.words)} words`);
    if (counts.cjk > 0) parts.push(`${formatNumber(counts.cjk)} characters`);
    if (counts.images > 0) parts.push(`${formatNumber(counts.images)} ${counts.images === 1 ? 'image' : 'images'}`);
    const speed = counts.cjk > 0 && counts.words === 0 ? `${this.settings.cjkPerMinute} characters per minute` : `${this.settings.wpm} words per minute`;
    return `${selection ? 'Selection: ' : ''}${parts.join(' · ')} · ${formatDuration(seconds, 'precise')} at ${speed}`;
  }

  showDetails() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice('Open a note to see its reading time.');
      return;
    }
    const { counts, seconds, selection } = this.measure(view);
    new Notice(this.describe(counts, seconds, selection), 6000);
  }

  /** Write the minutes to the note's properties. Returns whether the file changed. */
  async saveProperty(file: TFile, notify: boolean, text?: string): Promise<boolean> {
    const name = this.settings.propertyName.trim() || DEFAULT_SETTINGS.propertyName;
    const source = text ?? (await this.app.vault.cachedRead(file));
    const minutes = propertyMinutes(readingSeconds(countText(source, this.settings.includeCode), this.settings));
    const cached: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const existing = (cached as Record<string, unknown> | undefined)?.[name];
    if (existing === minutes) {
      if (notify) new Notice(`Already ${minutes} min in “${name}”.`);
      return false;
    }
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm[name] = minutes;
    });
    if (notify) new Notice(`Saved ${minutes} min to “${name}”.`);
    return true;
  }

  private async readLegacy(): Promise<LegacySettings | null> {
    const path = `${this.app.vault.configDir}/${LEGACY_DATA}`;
    if (!(await this.app.vault.adapter.exists(path))) return null;
    try {
      return JSON.parse(await this.app.vault.adapter.read(path)) as LegacySettings;
    } catch {
      return null;
    }
  }

  /** Copy Reading Time's settings. Returns false if there were none. */
  async importLegacy(): Promise<boolean> {
    const legacy = await this.readLegacy();
    if (!legacy) return false;
    Object.assign(this.settings, fromLegacy(legacy), { legacyChecked: true });
    await this.saveSettings();
    return true;
  }

  /** On first run, adopt the original's settings and say so once. */
  private async offerLegacyImport() {
    if (this.settings.legacyChecked) return;
    const imported = await this.importLegacy();
    if (imported) new Notice('Imported your reading speed from the Reading Time plugin. Turn that plugin off to avoid two entries in the status bar.', 10000);
    this.settings.legacyChecked = true;
    await this.saveData(this.settings);
  }
}

/** Asks before writing to every note: it edits a lot of files at once. */
class ConfirmAllModal extends Modal {
  constructor(
    app: App,
    private plugin: NoteReadingTimePlugin,
  ) {
    super(app);
  }

  onOpen() {
    const files = this.app.vault.getMarkdownFiles();
    const name = this.plugin.settings.propertyName.trim() || DEFAULT_SETTINGS.propertyName;
    this.titleEl.setText('Save reading times');
    this.contentEl.createEl('p', {
      text: `This adds or updates the “${name}” property in up to ${formatNumber(files.length)} notes. Notes that already have the right number are not touched.`,
    });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText('Save to all notes')
          .setCta()
          .onClick(() => {
            this.close();
            void this.run(files);
          }),
      );
  }

  private async run(files: TFile[]) {
    const notice = new Notice('Saving reading times…', 0);
    let changed = 0;
    let failed = 0;
    for (const [i, file] of files.entries()) {
      try {
        if (await this.plugin.saveProperty(file, false)) changed++;
      } catch {
        failed++;
      }
      if (i % 25 === 0) notice.setMessage(`Saving reading times… ${i} of ${files.length}`);
    }
    notice.hide();
    new Notice(`Reading times saved: ${changed} updated, ${files.length - changed - failed} already right${failed ? `, ${failed} failed` : ''}.`, 8000);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class NoteReadingTimeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: NoteReadingTimePlugin,
  ) {
    super(app, plugin);
  }

  /**
   * The settings, described rather than drawn. Obsidian 1.13 and later
   * renders this itself and indexes it for the settings search. Older
   * versions ignore it and call `display()`.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const d = DEFAULT_SETTINGS;
    return [
      {
        type: 'group',
        heading: 'Reading speed',
        items: [
          { ...TEXT.wpm, control: { type: 'number', key: 'wpm', min: 50, max: 1500, defaultValue: d.wpm } },
          { ...TEXT.cjkPerMinute, control: { type: 'number', key: 'cjkPerMinute', min: 50, max: 3000, defaultValue: d.cjkPerMinute } },
          { ...TEXT.secondsPerImage, control: { type: 'number', key: 'secondsPerImage', min: 0, max: 120, defaultValue: d.secondsPerImage } },
          { ...TEXT.includeCode, control: { type: 'toggle', key: 'includeCode', defaultValue: d.includeCode } },
        ],
      },
      {
        type: 'group',
        heading: 'Display',
        items: [
          { ...TEXT.showStatusBar, control: { type: 'toggle', key: 'showStatusBar', defaultValue: d.showStatusBar } },
          { ...TEXT.durationStyle, control: { type: 'dropdown', key: 'durationStyle', options: STYLES, defaultValue: d.durationStyle } },
          { ...TEXT.template, control: { type: 'text', key: 'template', placeholder: '{time} read', defaultValue: d.template } },
          { ...TEXT.selectionTemplate, control: { type: 'text', key: 'selectionTemplate', placeholder: '{time} (selection)', defaultValue: d.selectionTemplate } },
        ],
      },
      {
        type: 'group',
        heading: 'Properties',
        items: [{ ...TEXT.propertyName, control: { type: 'text', key: 'propertyName', placeholder: 'reading-time', defaultValue: d.propertyName } }],
      },
      { ...TEXT.legacy, action: () => void this.importLegacy() },
    ];
  }

  getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    Object.assign(this.plugin.settings, { [key]: value });
    await this.plugin.saveSettings();
  }

  private async importLegacy() {
    if (await this.plugin.importLegacy()) {
      new Notice('Imported the settings of Reading Time.');
      this.redraw();
    } else new Notice('Reading Time has no settings in this vault.');
  }

  private legacy = false;

  private redraw() {
    if (this.legacy) {
      this.draw();
      return;
    }
    // Obsidian 1.13's re-render of the declarative definitions, looked up because older versions lack it.
    (this as unknown as { update?: () => void }).update?.();
  }

  /** The pre-1.13 rendering, from the same text. Obsidian skips it once `getSettingDefinitions()` returns anything. */
  display(): void {
    this.legacy = true;
    this.draw();
  }

  private draw(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName('Reading speed').setHeading();
    this.number('wpm', TEXT.wpm, 50, 1500);
    this.number('cjkPerMinute', TEXT.cjkPerMinute, 50, 3000);
    this.number('secondsPerImage', TEXT.secondsPerImage, 0, 120);
    this.toggle('includeCode', TEXT.includeCode);
    new Setting(containerEl).setName('Display').setHeading();
    this.toggle('showStatusBar', TEXT.showStatusBar);
    new Setting(containerEl)
      .setName(TEXT.durationStyle.name)
      .setDesc(TEXT.durationStyle.desc)
      .addDropdown((dd) =>
        dd
          .addOptions(STYLES)
          .setValue(this.plugin.settings.durationStyle)
          .onChange((v) => this.setControlValue('durationStyle', v)),
      );
    this.text('template', TEXT.template);
    this.text('selectionTemplate', TEXT.selectionTemplate);
    new Setting(containerEl).setName('Properties').setHeading();
    this.text('propertyName', TEXT.propertyName);
    new Setting(containerEl)
      .setName(TEXT.legacy.name)
      .setDesc(TEXT.legacy.desc)
      .addButton((b) => b.setButtonText('Import').onClick(() => void this.importLegacy()));
  }

  private toggle(key: keyof NoteReadingTimeSettings, text: { name: string; desc: string }) {
    new Setting(this.containerEl)
      .setName(text.name)
      .setDesc(text.desc)
      .addToggle((t) => t.setValue(Boolean(this.plugin.settings[key])).onChange((v) => this.setControlValue(key, v)));
  }

  private text(key: keyof NoteReadingTimeSettings, text: { name: string; desc: string }) {
    new Setting(this.containerEl)
      .setName(text.name)
      .setDesc(text.desc)
      .addText((t) => t.setValue(String(this.plugin.settings[key])).onChange((v) => this.setControlValue(key, v)));
  }

  private number(key: keyof NoteReadingTimeSettings, text: { name: string; desc: string }, min: number, max: number) {
    new Setting(this.containerEl)
      .setName(text.name)
      .setDesc(text.desc)
      .addText((t) =>
        t.setValue(String(this.plugin.settings[key])).onChange((v) => {
          const n = Number(v);
          if (v.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) return this.setControlValue(key, n);
        }),
      );
  }
}
