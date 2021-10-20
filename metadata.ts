export default {
  'name:pt-BR': 'Separar em blocos',
  'namespace': 'http://nadameu.com.br',
  'match': [
    'https://eproc.jfsc.jus.br/eprocV2/controlador.php?acao=processo_selecionar&*',
    'https://eproc.jfsc.jus.br/eprocV2/controlador.php?acao=localizador_processos_lista&*',
    'https://eproc.jfsc.jus.br/eprocV2/controlador.php?acao=relatorio_geral_consultar&*',
  ],
  'grant': 'none',
  'description': 'Permite a separação de processos em blocos para movimentação separada',
  'require':
    'https://cdn.jsdelivr.net/combine/npm/preact@10.5.15/dist/preact.umd.min.js,npm/preact@10.5.15/hooks/dist/hooks.umd.min.js',
};
