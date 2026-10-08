# Note Reading Time

See how long the note in front of you takes to read, in the status bar.

![The status bar showing "3 min read" under a page of text](https://raw.githubusercontent.com/perezamadorluisenrique-gif/note-reading-time/main/docs/status-bar.png)

Select a paragraph and the status bar switches to the time for just that
selection ("1 min (selection)"). Hover it for the word count and the speed
behind the number, or click it to see the same as a notice, which also works
on mobile through the **Show the reading time of this note or selection**
command.

## What counts as reading

The estimate is for the text a person reads, not for everything in the file:

- Front matter (the properties block), comments (`%% … %%` and `<!-- … -->`),
  code blocks, math and link addresses are skipped. The text of a link
  counts, and so does the alias of a wikilink.
- Chinese, Japanese and Korean are counted by character, since they have no
  spaces to count words by (400 characters per minute by default).
- Images can add time: set **Seconds per image** if you want them to.
- Code blocks can be counted from the settings.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Reading speed | 230 wpm | Words per minute for alphabetic scripts. |
| Chinese, Japanese and Korean speed | 400 | Characters per minute for those scripts. |
| Seconds per image | 0 | Time added for each embedded image. |
| Count code blocks | off | Count the words inside code blocks. |
| Show in the status bar | on | Turn the status bar entry off if you only want the commands. |
| Time format | `5 min` | `5 min` or `1 h 5 min`, `5 min 30 s`, or `5:30`. |
| Status bar text | `{time} read` | `{time}` is the duration: `Reading: {time}` works too. |
| Text for a selection | `{time} (selection)` | Shown instead while text is selected. |
| Property name | `reading-time` | The note property the commands below fill in. |

## Commands

| Command | What it does |
|---|---|
| Show the reading time of this note or selection | A notice with the words, characters, images, time and speed. |
| Save the reading time to this note's properties | Writes the minutes to the `reading-time` property, so you can sort or filter notes by it in Bases or Dataview. It only edits the file if the number changed. |
| Save the reading time to the properties of every note | The same for the whole vault, after asking first. Notes that already have the right number are not touched. |

The property is never written unless you run a command: nothing in this plugin
edits your notes by itself.

## Coming from Reading Time

This plugin does what
[Reading Time](https://github.com/avr/obsidian-reading-time) does and adds
selections, reading view, Chinese, Japanese and Korean, front matter and
comment handling, images, a configurable format and the property commands. On
first run it copies that plugin's reading speed and text, and **Settings →
Import from Reading Time** does it again at any time. Turn the old plugin off,
or the status bar will show two entries.

## Installation

In Obsidian, open **Settings → Community plugins → Browse** and search for
"Note Reading Time".

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Shared Blocks](https://obsidian.md/plugins?id=shared-blocks) | Write a block of text once and reuse it in any note. Edit the source and every reference re-renders live. | [shared-blocks](https://github.com/perezamadorluisenrique-gif/shared-blocks) |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change case, make camelCase or slugs, sort lines and remove duplicates, and repair text pasted out of a PDF, without touching code or URLs. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |
| [Section Numbering](https://obsidian.md/plugins?id=section-numbering) | Number headings as an outline (1, 1.1, 1.2) and keep every link to them working when they renumber. | [section-numbering](https://github.com/perezamadorluisenrique-gif/section-numbering) |
| [Spreadsheet to Table](https://obsidian.md/plugins?id=spreadsheet-to-table) | Paste cells from Excel or Google Sheets as a Markdown table with a real header, insert CSV files, and copy tables back out. | [spreadsheet-to-table](https://github.com/perezamadorluisenrique-gif/spreadsheet-to-table) |
| [Hybrid Line Numbers](https://obsidian.md/plugins?id=hybrid-line-numbers) | Relative and hybrid line numbers for Vim-style jumps, where a folded section counts as one line. | [hybrid-line-numbers](https://github.com/perezamadorluisenrique-gif/hybrid-line-numbers) |
| [List Item Callouts](https://obsidian.md/plugins?id=list-item-callouts) | Colour a single list item as a callout by starting it with a character such as `&`, `!` or `?`. | [list-item-callouts](https://github.com/perezamadorluisenrique-gif/list-item-callouts) |
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes or files each folder holds, right in the file explorer, with a vault total and folder exclusions. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Roll unfinished tasks from your last daily note into today's when it is created, with a real undo. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |
| [Zoom Into Section](https://obsidian.md/plugins?id=zoom-into-section) | Zoom into a heading or list item to see only it and its contents, with a breadcrumb bar to climb back out. | [zoom-into-section](https://github.com/perezamadorluisenrique-gif/zoom-into-section) |
| [Link Title on Paste](https://obsidian.md/plugins?id=link-title-on-paste) | Paste a web address and get a Markdown link with the page's title, fetched in the background and undone in one step. | [link-title-on-paste](https://github.com/perezamadorluisenrique-gif/link-title-on-paste) |
| [Update Radar](https://obsidian.md/plugins?id=update-radar) | Checks your installed community plugins for updates in the background, shows what changed, and flags the ones that look abandoned. | [community-update-checker](https://github.com/perezamadorluisenrique-gif/community-update-checker) |
| [Dataview to Bases](https://obsidian.md/plugins?id=dataview-to-bases) | Convert Dataview queries into Bases blocks, and see which queries in your vault can be converted. | [dataview-to-bases](https://github.com/perezamadorluisenrique-gif/dataview-to-bases) |
| [Line Editing Commands](https://obsidian.md/plugins?id=line-editing-commands) | Duplicate, join, sort and reverse lines, insert blank lines and jump to a line number, with multi-cursor support. | [line-editing-commands](https://github.com/perezamadorluisenrique-gif/line-editing-commands) |
| [Note Mover Rules](https://obsidian.md/plugins?id=note-mover-rules) | Move notes into folders by ordered rules on tags, properties, titles and paths, with a preview before any bulk move. | [note-mover-rules](https://github.com/perezamadorluisenrique-gif/note-mover-rules) |
| [Tab History](https://obsidian.md/plugins?id=tab-history) | Keeps each tab's back and forward history across restarts, and adds commands to move, maximize and close tabs. | [tab-history](https://github.com/perezamadorluisenrique-gif/tab-history) |
| [URL Cards](https://obsidian.md/plugins?id=url-cards) | Shows web addresses as cards with title, description and image, and reads existing cardlink blocks. | [url-cards](https://github.com/perezamadorluisenrique-gif/url-cards) |
| [Vim Config](https://obsidian.md/plugins?id=vim-config) | Loads a vimrc-style file from your vault so your key mappings and editor commands are ready when vim mode starts. | [vim-config](https://github.com/perezamadorluisenrique-gif/vim-config) |
| [Task Archive](https://obsidian.md/plugins?id=task-archive) | Moves completed tasks, with their sub-items, into an archive section or note. | [task-archive](https://github.com/perezamadorluisenrique-gif/task-archive) |

All of them are in the community directory: Settings -> Community plugins ->
Browse, then search for the name.

## License

MIT
