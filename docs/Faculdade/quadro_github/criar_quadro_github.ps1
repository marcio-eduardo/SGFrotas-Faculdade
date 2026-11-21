<#
.SYNOPSIS
  Cria o quadro Scrum do SGFrotas no GitHub Projects, na conta PESSOAL logada no gh CLI.

.DESCRIPTION
  A partir de backlog_sgfrotas.csv cria: labels (épicos), milestones (sprints), um GitHub Project
  com os campos Story Points, Sprint e Épico, e uma issue por história de usuário já adicionada ao quadro.
  Recusa rodar se o repositório não pertencer à conta logada no gh.

.PARAMETER Repo
  Repositório pessoal que receberá as issues, no formato usuario/repositorio (precisa já existir).

.PARAMETER DryRun
  Só lista o que seria criado. Não precisa do gh nem de login.

.EXAMPLE
  .\criar_quadro_github.ps1 -Repo meu-usuario/sgfrotas-backlog -DryRun
  .\criar_quadro_github.ps1 -Repo meu-usuario/sgfrotas-backlog
#>
param(
    [Parameter(Mandatory)][string]$Repo,
    [string]$ProjectTitle = 'SGFrotas - Backlog Scrum 2026',
    [string]$Csv,
    [switch]$DryRun,
    [switch]$Yes
)
$ErrorActionPreference = 'Stop'
if (-not $Csv) {
    $dir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $Csv = Join-Path $dir 'backlog_sgfrotas.csv'
}

$rows = Import-Csv -Path $Csv -Encoding UTF8

# Sprints (datas conforme o cronograma da Tarefa 3)
$sprints = [ordered]@{
    'Sprint 0' = @{ due = '2026-10-02'; goal = 'Imersão e setup de arquitetura' }
    'Sprint 1' = @{ due = '2026-10-16'; goal = 'Controle de veículos e Central Anti-NIC' }
    'Sprint 2' = @{ due = '2026-10-30'; goal = 'Gestão de prazos e Ficha Técnica 360°' }
    'Sprint 3' = @{ due = '2026-11-13'; goal = 'Controle de manutenções e odômetros' }
    'Sprint 4' = @{ due = '2026-11-27'; goal = 'Combustível ValeCard e motor anti-fraude' }
    'Sprint 5' = @{ due = '2026-12-11'; goal = 'PWA do técnico: checklist 360° e offline' }
    'Sprint 6' = @{ due = '2026-12-28'; goal = 'Abastecimento em campo e homologação nas 17 BOPs' }
}
$epicos = $rows.Epico | Select-Object -Unique

function New-IssueBody($r) {
@"
**Persona:** $($r.Persona)
**Épico:** $($r.Epico) · **Sprint:** $($r.Sprint) · **Story Points:** $($r.StoryPoints)
**Dependência:** $($r.Dependencia)

## Critério de aceitação
$($r.CriterioAceitacao)

### Cenário (BDD)
$($r.Gherkin -replace '; ', "`n")

## Definition of Ready
- [ ] Persona e objetivo de negócio claros
- [ ] Critérios de aceitação em BDD/Gherkin
- [ ] Telas e fluxos desenhados no protótipo (Figma/HTML)
- [ ] Dependências de banco e APIs externas mapeadas
- [ ] Story Points estimados e aprovados pela equipe

## Definition of Done
- [ ] Código seguindo Clean Code e tipagem estrita
- [ ] Testes (pytest/vitest) com cobertura acima de 85% e 100% verdes
- [ ] Sem regressões visuais em Desktop (1440px) e Mobile (375px)
- [ ] Migrações Flyway versionadas e aplicadas sem falhas
- [ ] Walkthrough técnico registrado em walkthrough/
- [ ] Homologação visual aprovada pelo Tech Lead e pelo Product Owner
"@
}

if ($DryRun) {
    Write-Host "[dry-run] Repositório: $Repo   Projeto: $ProjectTitle" -ForegroundColor Cyan
    Write-Host "[dry-run] Labels: user-story, $($epicos -join ', ')"
    $sprints.GetEnumerator() | ForEach-Object { Write-Host "[dry-run] Milestone: $($_.Key) (vence $($_.Value.due))" }
    $rows | ForEach-Object { Write-Host ("[dry-run] {0} | {1} | {2} | {3} SP | {4}" -f $_.ID, $_.Sprint, $_.Epico, $_.StoryPoints, $_.Titulo) }
    $total = ($rows | Measure-Object -Property StoryPoints -Sum).Sum
    Write-Host "[dry-run] $($rows.Count) histórias, $total Story Points no total." -ForegroundColor Cyan
    return
}

function Invoke-Gh {
    $out = & gh @args
    if ($LASTEXITCODE -ne 0) { throw "Falhou: gh $($args -join ' ')" }
    return $out
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'gh CLI não encontrado. Instale com: winget install GitHub.cli  e faça: gh auth login'
}

# Garante que a conta logada é a pessoal e que o repositório é dela
$login = (Invoke-Gh api user --jq .login | Select-Object -First 1).Trim()
$owner = $Repo.Split('/')[0]
if ($owner -ne $login) {
    throw "O repositório '$Repo' não pertence à conta logada no gh ('$login'). Use um repositório da sua conta pessoal ou troque a conta com: gh auth login"
}
Invoke-Gh repo view $Repo --json name | Out-Null

if (-not $Yes) {
    Write-Host "Conta GitHub: $login" -ForegroundColor Yellow
    Write-Host "Repositório : $Repo"
    Write-Host "Serão criadas $($rows.Count) issues, $($sprints.Count) milestones e 1 GitHub Project '$ProjectTitle'."
    if ((Read-Host 'Continuar? (s/N)') -notmatch '^[sSyY]') { return }
}

# O comando 'gh project' exige o escopo 'project'
$status = (& gh auth status 2>&1) -join "`n"
if ($status -notmatch 'project') { & gh auth refresh -s project }

Write-Host '1/5 Labels...' -ForegroundColor Cyan
Invoke-Gh label create 'user-story' --repo $Repo --color '0284C7' --description 'História de usuário' --force | Out-Null
foreach ($e in $epicos) {
    Invoke-Gh label create $e --repo $Repo --color '64748B' --description "Épico: $e" --force | Out-Null
}

Write-Host '2/5 Milestones (sprints)...' -ForegroundColor Cyan
$existentes = @(Invoke-Gh api "repos/$Repo/milestones?state=all" --jq '.[].title')
foreach ($s in $sprints.GetEnumerator()) {
    if ($existentes -contains $s.Key) { continue }
    Invoke-Gh api "repos/$Repo/milestones" --method POST -f "title=$($s.Key)" -f "description=$($s.Value.goal)" -f "due_on=$($s.Value.due)T23:59:59Z" | Out-Null
}

Write-Host '3/5 Projeto...' -ForegroundColor Cyan
$p = (Invoke-Gh project create --owner '@me' --title $ProjectTitle --format json) -join '' | ConvertFrom-Json
try { Invoke-Gh project link $p.number --owner '@me' --repo $Repo | Out-Null } catch { Write-Warning 'Não foi possível vincular o repositório ao projeto (faça pela interface, se quiser).' }
Invoke-Gh project field-create $p.number --owner '@me' --name 'Story Points' --data-type NUMBER | Out-Null
Invoke-Gh project field-create $p.number --owner '@me' --name 'Sprint' --data-type SINGLE_SELECT --single-select-options ($sprints.Keys -join ',') | Out-Null
Invoke-Gh project field-create $p.number --owner '@me' --name 'Épico' --data-type SINGLE_SELECT --single-select-options ($epicos -join ',') | Out-Null

$fields = ((Invoke-Gh project field-list $p.number --owner '@me' --format json) -join '' | ConvertFrom-Json).fields
$fSP     = $fields | Where-Object name -eq 'Story Points'
$fSprint = $fields | Where-Object name -eq 'Sprint'
$fEpico  = $fields | Where-Object name -eq 'Épico'
$fStatus = $fields | Where-Object name -eq 'Status'
function Option($field, $name) { ($field.options | Where-Object name -eq $name).id }

Write-Host '4/5 Issues e itens do quadro...' -ForegroundColor Cyan
foreach ($r in $rows) {
    $tmp = New-TemporaryFile
    Set-Content -Path $tmp -Value (New-IssueBody $r) -Encoding UTF8
    $url = (Invoke-Gh issue create --repo $Repo --title "$($r.ID) - $($r.Titulo)" --body-file $tmp --label "user-story,$($r.Epico)" --milestone $r.Sprint | Select-Object -Last 1).Trim()
    Remove-Item $tmp -Force

    $item = (Invoke-Gh project item-add $p.number --owner '@me' --url $url --format json) -join '' | ConvertFrom-Json
    Invoke-Gh project item-edit --id $item.id --project-id $p.id --field-id $fSP.id --number $r.StoryPoints | Out-Null
    Invoke-Gh project item-edit --id $item.id --project-id $p.id --field-id $fSprint.id --single-select-option-id (Option $fSprint $r.Sprint) | Out-Null
    Invoke-Gh project item-edit --id $item.id --project-id $p.id --field-id $fEpico.id --single-select-option-id (Option $fEpico $r.Epico) | Out-Null
    Invoke-Gh project item-edit --id $item.id --project-id $p.id --field-id $fStatus.id --single-select-option-id (Option $fStatus $r.Status) | Out-Null
    if ($r.Status -eq 'Done') { Invoke-Gh issue close $url --reason completed | Out-Null }
    Write-Host "  $($r.ID) -> $url"
}

Write-Host '5/5 Pronto.' -ForegroundColor Green
Write-Host "Quadro: $($p.url)"
Write-Host "Falta só criar as visões pela interface: Board (agrupado por Status), Tabela (agrupada por Sprint) e Roadmap."
