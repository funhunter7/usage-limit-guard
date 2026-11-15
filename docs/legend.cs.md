# Legenda status-line

Ukázka řádku (kompaktní rozvržení, terminál úrovně „full"):

```text
Opus 5.5 │ ▰▰▰▰▱▱▱▱▱▱ 42% │ 5h 84%↑ 20:08 │ 7d 25% st 09:00 │ 🏠 my-project │ 🔀 rule-fixes │ 📁 scratchpad
```

Každou část můžeš vypnout v nastavení (`show_model`, `show_context`, `pace_arrow`, `show_paths`, `window_display`).
Části bez dat se vynechají. Stejný přehled vypíše `/limit-guard-legend`; `/limit-guard-legend on` zobrazí stejné vysvětlivky
v pruhu nad promptem (tlačítko `ⓘ popisky` tam dělá totéž, hned a bez čekání na status-line).

<a id="model"></a>
## Model

Model, který Claude Code právě používá (například `Opus 5.5`). Nemá barevné prahy, jen název.
Po přepnutí přes `/model` se změní hned.

<a id="pamet-konverzace"></a>
## Paměť konverzace

Desetidílný pruh s procenty kontextového okna zaplněného touto konverzací.
Zelená do 50 %, oranžová do 80 %, od 80 % červená. Hodnota se zobrazí, až ji Claude Code pošle (ne hned na začátku relace a těsně po `/compact`). Při červené spusť `/compact` nebo začni novou relaci.

<a id="limit-relace-5h"></a>
## Limit relace (5h)

`5h 84%↑ 20:08`: kolik z pětihodinového okna jsi spotřeboval a kdy se obnoví (týž den jen čas,
jindy zkratka dne a čas). Procento je zelené, od `warn_band` (výchozí 80 %) oranžové a od `threshold`
(výchozí 95 %) červené; tam hlídač uloží předání práce. Při červené dokonči rozdělanou práci
nebo počkej na reset. S `window_display: nearest` se zobrazí jen okno nejblíž prahu. Šipku vysvětluje
[Šipka tempa](#sipka-tempo).

<a id="tydenni-limit-7d"></a>
## Týdenní limit (7d)

`7d 25% st 09:00`: totéž pro sedmidenní okno. `7dO` a `7dS` jsou samostatná týdenní okna pro Opus a Sonnet
(zobrazí se, když je používáš). Barvy a prahy jsou stejné jako u limitu relace.
Červený týdenní limit znamená čekat na reset (nebo změnit tarif), takže větší úkoly si naplánuj.

<a id="sipka-tempo"></a>
## Šipka tempa

`↑` (v ascii terminálech `^`) za procentem znamená, že jsi o 10 a více bodů před uplynulým časem okna.
Příklad: uplynulo 5 % času okna, ale spotřeboval jsi 20 %. Je to tip zpomalit, ne chyba.
Vypneš ji přes `pace_arrow: false`.

<a id="odhad-do-prahu"></a>
## Odhad do prahu

`📈 ~1h40m do 90%`: odhad, za jak dlouho dosáhne prahu nejdřív ohrožené okno, podle nedávného vývoje
spotřeby. Zobrazí se jen s `projection_display: on` a dostatkem historie. Ber to jako hrubý odhad.

<a id="projekt"></a>
## Projekt

Název složky projektu (`workspace.project_dir`). Kliknutím ji otevřeš tam, kde odkazy fungují.

<a id="worktree"></a>
## Worktree

`🔀 název`: zobrazí se jen v relaci běžící v propojeném git worktree. Kliknutím otevřeš složku worktree.

<a id="odkladaci-slozka"></a>
## Odkládací složka

`📁 scratchpad`: odkládací složka této relace, zobrazí se jen když existuje a není prázdná.
Výchozí je vestavěný scratchpad Claude Code; vlastní složku nastav přes `scratch_dir` (relativně k projektu).

## Úrovně terminálu

Vzhled se řídí tím, co tvůj terminál umí vykreslit (`style: auto`, nebo vynuť `emoji` = full, `basic`, `ascii`):

| Úroveň | Kde | Vzhled |
|--------|-----|--------|
| full | Windows Terminal, iTerm2, WezTerm, VS Code, Kitty, Alacritty, ... | 256 barev, pruh `▰▱`, oddělovač `│`, `🔀`/`📁`, odkazy |
| basic | tmux/screen, JetBrains, Konsole, Terminal.app, ostatní unixové terminály | 16 barev, pruh `█░`, `│`, bez emoji, bez odkazů |
| ascii | starší konzole Windows (cmd/PowerShell), `TERM=dumb` | 16 barev, pruh `[####------]`, `\|`, šipka `^`, bez odkazů |

`NO_COLOR` vypne všechny barvy. Znaky pruhu změníš přes `bar_style`.

<a id="odkazy-v-terminalu"></a>
## Odkazy v terminálu

Odkazy na složky fungují v úrovni full. Ve Windows Terminalu Claude Code odkazy skrývá, dokud v jeho prostředí není
`FORCE_HYPERLINK=1`. `/limit-guard-setup` ti nabídne, že ho přidá do `settings.json` (`env`); pak platí pro všechny
odkazy, které Claude Code vypisuje. `FORCE_HYPERLINK=0` odkazy všude vypne.
