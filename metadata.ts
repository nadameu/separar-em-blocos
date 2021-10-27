import * as pkg from './package.json';

const preactVersion = pkg.dependencies.preact;
const idbVersion = pkg.dependencies.idb;

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
  'require': [
    `https://unpkg.com/preact@${preactVersion}/dist/preact.umd.js`,
    `https://unpkg.com/preact@${preactVersion}/hooks/dist/hooks.umd.js`,
    `https://unpkg.com/idb@${idbVersion}/build/iife/index-min.js`,
  ],
};
