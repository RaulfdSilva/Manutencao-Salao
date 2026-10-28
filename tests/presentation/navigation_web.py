"""Optional real-browser smoke check. Requires Python Playwright and Chromium, not npm dependencies.
Run after web export: python tests/presentation/navigation_web.py --export-dir /tmp/app-navigation-ui-web
"""
import argparse
import functools
import re
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if not Path(self.translate_path(path)).is_file() and not Path(path).suffix:
            self.path = '/index.html'
        super().do_GET()

    def log_message(self, *_args):
        pass


def verify(page, base, width, screenshots):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='networkidle')
    expect(page.get_by_role('heading', name='Olá, seja bem-vindo.')).to_be_visible()
    expect(page.get_by_text('Dados fictícios. Nenhuma alteração é salva.')).to_be_visible()
    expect(page.get_by_role('tab')).to_have_count(4)
    for label in ['Início', 'Manutenções', 'Pendências', 'Equipe']:
        expect(page.get_by_role('tab', name=label, exact=True)).to_be_visible()
    if screenshots:
        page.screenshot(path=str(screenshots / f'home-{width}.png'))
    print(f'PASS {width}: four accessible tabs and explicit demonstration')

    page.get_by_role('tab', name='Manutenções', exact=True).click()
    expect(page).to_have_url(re.compile('/maintenance$'))
    for label, count in [('Programadas', 2), ('Concluídas', 1), ('Canceladas', 1), ('Todas', 4)]:
        page.get_by_role('button', name=label, exact=True).click()
        expect(page.get_by_role('button', name=re.compile('Ver detalhes$'))).to_have_count(count)
    page.get_by_role('button', name=re.compile('Revisão mensal.*Ver detalhes$')).click()
    expect(page).to_have_url(re.compile('/maintenance/demo-monthly$'))
    expect(page.get_by_role('heading', name='Checklist por equipamento')).to_be_visible()
    equipment = page.get_by_role('heading', name='Mesa de som', exact=True).locator('..')
    expect(equipment.get_by_text('Verificação das luzes piloto', exact=True)).to_have_count(1)
    expect(equipment.get_by_text('Teste das entradas (line, mic, aux, etc.)', exact=True)).to_have_count(1)
    expect(page.get_by_text('Limpeza geral', exact=True)).to_have_count(7)
    if screenshots:
        page.screenshot(path=str(screenshots / f'checklist-{width}.png'))
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Mesa de som', exact=True)).to_be_visible()
    page.get_by_role('button', name='‹  Voltar', exact=True).click()
    expect(page).to_have_url(re.compile('/maintenance$'))
    print(f'PASS {width}: filters, real detail navigation, grouped official checklist and deep-link reload')

    page.get_by_role('tab', name='Pendências', exact=True).click()
    page.get_by_role('button', name=re.compile('Desgaste aparente.*')).click()
    expect(page).to_have_url(re.compile('/issues/demo-issue-open$'))
    expect(page.get_by_role('heading', name='Detalhes da pendência')).to_be_visible()
    expect(page.get_by_text('Pendente', exact=True).filter(visible=True)).to_be_visible()
    expect(page.get_by_role('button', name='Marcar como concluída')).to_have_count(0)
    page.get_by_role('button', name='Ver manutenção de origem').click()
    expect(page).to_have_url(re.compile('/maintenance/demo-quarterly$'))
    expect(page.get_by_text('Problema encontrado', exact=True)).to_be_visible()
    print(f'PASS {width}: problem details, origin link and read-only controls')

    page.goto(base + '/team', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Equipe', exact=True)).to_be_visible()
    expect(page.get_by_text('Administrador de exemplo', exact=True)).to_be_visible()
    expect(page.get_by_text('Responsável de exemplo', exact=True)).to_be_visible()
    expect(page.get_by_text('Membro de exemplo', exact=True)).to_be_visible()
    assert not re.search(r'\btelefone\b|presença|pontuação|ranking|PRIVATE', page.locator('body').inner_text(), re.I)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow'
    if screenshots:
        page.screenshot(path=str(screenshots / f'team-{width}.png'))
    print(f'PASS {width}: public fictitious team and responsive layout')

    page.get_by_role('tab', name='Início', exact=True).click()
    page.get_by_role('button', name='Sem dados', exact=True).click()
    expect(page.get_by_role('heading', name='Nenhuma manutenção programada')).to_be_visible()
    for label, title in [('Equipe', 'Nenhum membro para exibir'), ('Manutenções', 'Nenhuma manutenção por aqui'), ('Pendências', 'Nenhuma pendência nesta seleção')]:
        page.get_by_role('tab', name=label, exact=True).click()
        expect(page.get_by_role('heading', name=title)).to_be_visible()
    page.get_by_role('tab', name='Início', exact=True).click()
    page.get_by_role('button', name='Carregando', exact=True).click()
    page.get_by_role('tab', name='Equipe', exact=True).click()
    expect(page.get_by_role('progressbar', name='Carregando demonstração')).to_be_visible()
    expect(page.get_by_text('Administrador de exemplo', exact=True)).to_have_count(0)
    page.get_by_role('tab', name='Início', exact=True).click()
    page.get_by_role('button', name='Com exemplos', exact=True).click()
    expect(page.get_by_text('Próxima manutenção no exemplo')).to_be_visible()
    print(f'PASS {width}: empty states on four screens, loading and recovery')

    for path, title in [('/maintenance/missing', 'Manutenção não encontrada'), ('/issues/missing', 'Pendência não encontrada')]:
        page.goto(base + path, wait_until='networkidle')
        expect(page.get_by_role('heading', name=title)).to_be_visible()
        expect(page.get_by_role('button', name='‹  Voltar', exact=True)).to_be_visible()
    assert not errors, f'Browser runtime errors: {errors}'
    print(f'PASS {width}: invalid routes handled; no JavaScript runtime errors')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--export-dir', required=True, type=Path)
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    if not (args.export_dir / 'index.html').is_file():
        parser.error('Export directory must contain index.html')
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(SpaHandler, directory=str(args.export_dir.resolve())))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=shutil.which('chromium') or shutil.which('google-chrome'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            try:
                for width, height in [(320, 740), (390, 844), (768, 1024)]:
                    context = browser.new_context(viewport={'width': width, 'height': height}, locale='pt-BR', timezone_id='America/Sao_Paulo')
                    try:
                        verify(context.new_page(), f'http://127.0.0.1:{server.server_port}', width, args.screenshots)
                    finally:
                        context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print('PASS: 18 browser verification groups across three viewport sizes')


if __name__ == '__main__':
    main()
