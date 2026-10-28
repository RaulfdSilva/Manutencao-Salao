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
from urllib.parse import urlsplit, unquote

from playwright.sync_api import expect, sync_playwright


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if not Path(self.translate_path(path)).is_file() and not Path(path).suffix:
            self.path = '/index.html'
        super().do_GET()

    def log_message(self, *_args):
        pass


class StaticPreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, base_path='', **kwargs):
        self.base_path = base_path
        super().__init__(*args, **kwargs)

    def translate_path(self, path):
        url_path = unquote(urlsplit(path).path)
        if self.base_path and not (url_path == self.base_path or url_path.startswith(self.base_path + '/')):
            return str(Path(self.directory) / '__outside_preview_base__')
        return super().translate_path(url_path[len(self.base_path):] or '/')

    def log_message(self, *_args):
        pass


def verify(page, base, width, screenshots, static=False):
    errors = []
    resource_errors = []
    prefix = urlsplit(base).path.rstrip('/') + '/'
    origin = f'{urlsplit(base).scheme}://{urlsplit(base).netloc}'
    resources = {'script', 'stylesheet', 'image', 'font', 'fetch', 'xhr'}
    def check_response(response):
        if response.request.resource_type in resources:
            if response.status >= 400:
                resource_errors.append(f'{response.status} {response.url}')
            if static and (not response.url.startswith(origin + prefix)):
                resource_errors.append(f'Resource outside preview prefix: {response.url}')
    page.on('response', check_response)
    page.on('requestfailed', lambda request: resource_errors.append(f'Failed request: {request.url}'))
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
    expect(page).to_have_url(re.compile('/maintenance/?$'))
    for label, count in [('Programadas', 2), ('Concluídas', 1), ('Canceladas', 1), ('Todas', 4)]:
        page.get_by_role('button', name=label, exact=True).click()
        expect(page.get_by_role('button', name=re.compile('Ver detalhes$'))).to_have_count(count)
    page.get_by_role('button', name=re.compile('Revisão mensal.*Ver detalhes$')).click()
    expect(page).to_have_url(re.compile('/maintenance/demo-monthly/?$'))
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
    expect(page).to_have_url(re.compile('/maintenance/?$'))
    print(f'PASS {width}: filters, real detail navigation, grouped official checklist and deep-link reload')

    page.get_by_role('tab', name='Pendências', exact=True).click()
    page.get_by_role('button', name=re.compile('Desgaste aparente.*')).click()
    expect(page).to_have_url(re.compile('/issues/demo-issue-open/?$'))
    expect(page.get_by_role('heading', name='Detalhes da pendência')).to_be_visible()
    expect(page.get_by_text('Pendente', exact=True).filter(visible=True)).to_be_visible()
    expect(page.get_by_role('button', name='Marcar como concluída')).to_have_count(0)
    page.get_by_role('button', name='Ver manutenção de origem').click()
    expect(page).to_have_url(re.compile('/maintenance/demo-quarterly/?$'))
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

    if static:
        direct_routes = [
            ('/', 'Olá, seja bem-vindo.'), ('/maintenance', 'Manutenções'),
            ('/issues', 'Pendências'), ('/team', 'Equipe'),
            ('/maintenance/demo-fortnightly', 'Cuidado periódico do áudio'),
            ('/maintenance/demo-monthly', 'Revisão mensal do sistema'),
            ('/maintenance/demo-quarterly', 'Inspeção trimestral de áudio'),
            ('/maintenance/demo-semiannual', 'Revisão semestral do sistema'),
            ('/issues/demo-issue-open', 'Detalhes da pendência'),
            ('/issues/demo-issue-resolved', 'Detalhes da pendência'),
        ]
        for path, title in direct_routes:
            for suffix in ['', '/'] if path != '/' else ['']:
                response = page.goto(base + path + suffix, wait_until='networkidle')
                assert response.status == 200, (path, response.status)
                expect(page.get_by_role('heading', name=title, exact=True)).to_be_visible()
                reloaded = page.reload(wait_until='networkidle')
                assert reloaded.status == 200, path
                expect(page.get_by_role('heading', name=title, exact=True)).to_be_visible()
                expect(page.get_by_role('button', name=re.compile(r'^(Salvar|Cadastrar|Entrar|Marcar como concluída)$'))).to_have_count(0)
                assert page.locator('form,input,textarea').count() == 0
                assert urlsplit(page.url).path.startswith(prefix)
        assert page.request.get(base + '/maintenance/nonexistent').status == 404
        print(f'PASS {width}: all 10 real routes opened directly and reloaded without server fallback; no writes/forms')
    else:
        for path, title in [('/maintenance/missing', 'Manutenção não encontrada'), ('/issues/missing', 'Pendência não encontrada')]:
            page.goto(base + path, wait_until='networkidle')
            expect(page.get_by_role('heading', name=title)).to_be_visible()
            expect(page.get_by_role('button', name='‹  Voltar', exact=True)).to_be_visible()
        print(f'PASS {width}: invalid routes handled; no JavaScript runtime errors')
    assert not errors, f'Browser runtime errors: {errors}'
    assert not resource_errors, f'Resource errors: {resource_errors}'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--export-dir', required=True, type=Path)
    parser.add_argument('--screenshots', type=Path)
    parser.add_argument('--static', action='store_true', help='Serve actual files only, no SPA fallback')
    parser.add_argument('--base-path', default='', help='Example: /Manutencao-Salao')
    args = parser.parse_args()
    args.base_path = '/' + args.base_path.strip('/') if args.base_path.strip('/') else ''
    if args.base_path and not args.static:
        parser.error('--base-path requires --static to verify real static routes')
    if not (args.export_dir / 'index.html').is_file():
        parser.error('Export directory must contain index.html')
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(StaticPreviewHandler, base_path=args.base_path) if args.static else SpaHandler
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(handler, directory=str(args.export_dir.resolve())))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=shutil.which('chromium') or shutil.which('google-chrome'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            try:
                for width, height in [(320, 740), (390, 844), (768, 1024)]:
                    context = browser.new_context(viewport={'width': width, 'height': height}, locale='pt-BR', timezone_id='America/Sao_Paulo')
                    try:
                        verify(context.new_page(), f'http://127.0.0.1:{server.server_port}{args.base_path}', width, args.screenshots, args.static)
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
