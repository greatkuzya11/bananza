
(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createEmojiPickerController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const text = objectOrDefault(opts.text);
    const actions = objectOrDefault(opts.actions);
    const storage = opts.storage || win.localStorage;
    const customEmoji = objectOrDefault(opts.customEmoji || root.customEmoji);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value == null ? '' : value));
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const getCurrentUser = typeof opts.getCurrentUser === 'function'
      ? opts.getCurrentUser
      : (typeof actions.getCurrentUser === 'function' ? actions.getCurrentUser : () => null);

    const EMOJIS = {
      '\uD83D\uDE00': ['\uD83D\uDE00','\uD83D\uDE03','\uD83D\uDE04','\uD83D\uDE01','\uD83D\uDE06','\uD83D\uDE05','\uD83E\uDD23','\uD83D\uDE02','\uD83D\uDE42','\uD83D\uDE09','\uD83D\uDE0A','\uD83D\uDE07','\uD83E\uDD70','\uD83D\uDE0D','\uD83E\uDD29','\uD83D\uDE18','\uD83D\uDE0B','\uD83D\uDE1B','\uD83D\uDE1C','\uD83E\uDD2A','\uD83D\uDE1D','\uD83E\uDD11','\uD83E\uDD17','\uD83E\uDD2D','\uD83E\uDD2B','\uD83E\uDD14','\uD83E\uDD10','\uD83E\uDD28','\uD83D\uDE10','\uD83D\uDE11','\uD83D\uDE36','\uD83D\uDE0F','\uD83D\uDE12','\uD83D\uDE44','\uD83D\uDE2C','\uD83D\uDE2E\u200D\uD83D\uDCA8','\uD83E\uDD25','\uD83D\uDE0C','\uD83D\uDE14','\uD83D\uDE2A','\uD83E\uDD24','\uD83D\uDE34','\uD83D\uDE37','\uD83E\uDD12','\uD83E\uDD15','\uD83E\uDD22','\uD83E\uDD2E','\uD83E\uDD75','\uD83E\uDD76','\uD83E\uDD74','\uD83D\uDE35','\uD83E\uDD2F','\uD83E\uDD20','\uD83E\uDD73','\uD83E\uDD78','\uD83D\uDE0E','\uD83E\uDD13','\uD83E\uDDD0','\uD83D\uDE15','\uD83D\uDE1F','\uD83D\uDE41','\u2639\uFE0F','\uD83D\uDE2E','\uD83D\uDE2F','\uD83D\uDE32','\uD83D\uDE33','\uD83E\uDD7A','\uD83D\uDE26','\uD83D\uDE27','\uD83D\uDE28','\uD83D\uDE30','\uD83D\uDE25','\uD83D\uDE22','\uD83D\uDE2D','\uD83D\uDE31','\uD83D\uDE16','\uD83D\uDE23','\uD83D\uDE1E','\uD83D\uDE13','\uD83D\uDE29','\uD83D\uDE2B','\uD83E\uDD71','\uD83D\uDE24','\uD83D\uDE21','\uD83D\uDE20','\uD83E\uDD2C','\uD83D\uDE08','\uD83D\uDC7F','\uD83D\uDC80','\u2620\uFE0F','\uD83D\uDCA9','\uD83E\uDD21','\uD83D\uDC79','\uD83D\uDC7A','\uD83D\uDC7B','\uD83D\uDC7D','\uD83D\uDC7E','\uD83E\uDD16'],
      '\uD83D\uDC4B': ['\uD83D\uDC4B','\uD83E\uDD1A','\uD83D\uDD90\uFE0F','\u270B','\uD83D\uDD96','\uD83E\uDEF1','\uD83E\uDEF2','\uD83E\uDEF3','\uD83E\uDEF4','\uD83D\uDC4C','\uD83E\uDD0C','\uD83E\uDD0F','\u270C\uFE0F','\uD83E\uDD1E','\uD83E\uDEF0','\uD83E\uDD1F','\uD83E\uDD18','\uD83E\uDD19','\uD83D\uDC48','\uD83D\uDC49','\uD83D\uDC46','\uD83D\uDD95','\uD83D\uDC47','\u261D\uFE0F','\uD83E\uDEF5','\uD83D\uDC4D','\uD83D\uDC4E','\u270A','\uD83D\uDC4A','\uD83E\uDD1B','\uD83E\uDD1C','\uD83D\uDC4F','\uD83D\uDE4C','\uD83E\uDEF6','\uD83D\uDC50','\uD83E\uDD32','\uD83E\uDD1D','\uD83D\uDE4F','\uD83D\uDCAA','\uD83E\uDDBE','\uD83D\uDDA4','\uD83D\uDC76','\uD83E\uDDD2','\uD83D\uDC66','\uD83D\uDC67','\uD83E\uDDD1','\uD83D\uDC68','\uD83D\uDC69','\uD83E\uDDD4','\uD83D\uDC71','\uD83D\uDC74','\uD83D\uDC75','\uD83D\uDE4D','\uD83D\uDE4E','\uD83D\uDE45','\uD83D\uDE46','\uD83D\uDC81','\uD83D\uDE4B','\uD83E\uDDCF','\uD83D\uDE47','\uD83E\uDD26','\uD83E\uDD37','\uD83D\uDC6E','\uD83D\uDD75\uFE0F','\uD83D\uDC82','\uD83E\uDD77','\uD83D\uDC77','\uD83E\uDDD1\u200D\u2695\uFE0F','\uD83E\uDDD1\u200D\uD83C\uDF93','\uD83E\uDDD1\u200D\uD83C\uDFEB','\uD83E\uDDD1\u200D\u2696\uFE0F','\uD83E\uDDD1\u200D\uD83C\uDF3E','\uD83E\uDDD1\u200D\uD83C\uDF73','\uD83E\uDDD1\u200D\uD83D\uDD27','\uD83E\uDDD1\u200D\uD83D\uDCBB','\uD83E\uDDD1\u200D\uD83C\uDFA4','\uD83E\uDDD1\u200D\uD83C\uDFA8','\uD83E\uDDD1\u200D\uD83D\uDE80','\uD83E\uDDD1\u200D\uD83D\uDE92','\uD83D\uDC70','\uD83E\uDD35','\uD83E\uDDD9','\uD83E\uDDDA','\uD83E\uDDDB','\uD83E\uDDDC','\uD83E\uDDDD','\uD83E\uDDDE','\uD83E\uDDDF','\uD83D\uDC86','\uD83D\uDC87','\uD83D\uDEB6','\uD83C\uDFC3','\uD83D\uDC83','\uD83D\uDD7A','\uD83E\uDDCD','\uD83E\uDDCE','\uD83E\uDDD8','\uD83D\uDEC0','\uD83D\uDECC','\uD83D\uDC6D','\uD83D\uDC6B','\uD83D\uDC6C','\uD83D\uDC8F','\uD83D\uDC91','\uD83D\uDC6A'],
      '\u2764\uFE0F': ['\u2764\uFE0F','\uD83E\uDDE1','\uD83D\uDC9B','\uD83D\uDC9A','\uD83D\uDC99','\uD83D\uDC9C','\uD83D\uDDA4','\uD83E\uDD0D','\uD83E\uDD0E','\uD83D\uDC94','\u2763\uFE0F','\uD83D\uDC95','\uD83D\uDC9E','\uD83D\uDC93','\uD83D\uDC97','\uD83D\uDC96','\uD83D\uDC98','\uD83D\uDC9D','\uD83D\uDC9F','\u2764\uFE0F\u200D\uD83D\uDD25','\u2764\uFE0F\u200D\uD83E\uDE79','\u2665\uFE0F'],
      '\uD83C\uDF89': ['\uD83C\uDF89','\uD83C\uDF8A','\uD83C\uDF88','\uD83C\uDF81','\uD83C\uDF80','\uD83C\uDF97\uFE0F','\uD83C\uDF9F\uFE0F','\uD83C\uDFAB','\uD83C\uDFC6','\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49','\u26BD','\uD83C\uDFC0','\uD83C\uDFC8','\u26BE','\uD83E\uDD4E','\uD83C\uDFBE','\uD83C\uDFD0','\uD83C\uDFC9','\uD83E\uDD4F','\uD83C\uDFB1','\uD83E\uDE80','\uD83C\uDFD3','\uD83C\uDFF8','\uD83E\uDD45','\uD83C\uDFD2','\uD83C\uDFD1','\uD83E\uDD4D','\uD83C\uDFCF','\u26F3','\uD83E\uDE81','\uD83C\uDFF9','\uD83C\uDFA3','\uD83E\uDD3F','\uD83E\uDD4A','\uD83E\uDD4B','\uD83C\uDFBD','\uD83D\uDEF9','\uD83D\uDEFC','\uD83D\uDEF7','\u26F8\uFE0F','\uD83E\uDD4C','\uD83C\uDFBF','\u26F7\uFE0F','\uD83C\uDFC2','\uD83E\uDE82','\uD83C\uDFCB\uFE0F','\uD83E\uDD3C','\uD83E\uDD38','\u26F9\uFE0F','\uD83E\uDD3A','\uD83E\uDD3E','\uD83C\uDFCC\uFE0F','\uD83C\uDFC7','\uD83E\uDDD8','\uD83C\uDFC4','\uD83C\uDFCA','\uD83E\uDD3D','\uD83D\uDEA3','\uD83E\uDDD7','\uD83D\uDEB4','\uD83D\uDEB5','\uD83C\uDFAE','\uD83D\uDD79\uFE0F','\uD83C\uDFB2','\u265F\uFE0F','\uD83C\uDFAF','\uD83C\uDFB3','\uD83C\uDFB0','\uD83E\uDDE9','\uD83C\uDFAD','\uD83C\uDFA8','\uD83E\uDDF5','\uD83E\uDEA1','\uD83C\uDFA4','\uD83C\uDFA7','\uD83C\uDFBC','\uD83C\uDFB9','\uD83E\uDD41','\uD83E\uDE98','\uD83C\uDFB7','\uD83C\uDFBA','\uD83E\uDE97','\uD83C\uDFB8','\uD83E\uDE95','\uD83C\uDFBB','\uD83C\uDFAC','\uD83C\uDFAA'],
      '\uD83C\uDF55': ['\uD83C\uDF55','\uD83C\uDF54','\uD83C\uDF5F','\uD83C\uDF2D','\uD83C\uDF7F','\uD83E\uDDC0','\uD83E\uDD5A','\uD83C\uDF73','\uD83E\uDD5E','\uD83E\uDDC7','\uD83E\uDD53','\uD83C\uDF57','\uD83C\uDF56','\uD83C\uDF2E','\uD83C\uDF2F','\uD83C\uDF5D','\uD83C\uDF5C','\uD83C\uDF63','\uD83C\uDF71','\uD83E\uDD5F','\uD83C\uDF66','\uD83C\uDF69','\uD83C\uDF6A','\uD83C\uDF82','\uD83C\uDF70','\uD83E\uDDC1','\uD83C\uDF6B','\uD83C\uDF6C','\uD83C\uDF6D','\u2615','\uD83C\uDF75','\uD83E\uDDC3','\uD83E\uDDCB','\uD83C\uDF7A','\uD83C\uDF7B','\uD83E\uDD42','\uD83C\uDF77','\uD83C\uDF78','\uD83C\uDF79','\uD83E\uDD64','\uD83C\uDF4C'],
      '\uD83C\uDF3F': ['\uD83C\uDF38','\uD83C\uDF3A','\uD83C\uDF3B','\uD83C\uDF39','\uD83C\uDF37','\uD83C\uDF3C','\uD83C\uDF3F','\u2618\uFE0F','\uD83C\uDF40','\uD83C\uDF41','\uD83C\uDF42','\uD83C\uDF32','\uD83C\uDF33','\uD83C\uDF34','\uD83C\uDF35','\uD83D\uDC36','\uD83D\uDC31','\uD83D\uDC2D','\uD83D\uDC39','\uD83D\uDC30','\uD83E\uDD8A','\uD83D\uDC3B','\uD83D\uDC3C','\uD83D\uDC28','\uD83D\uDC2F','\uD83E\uDD81','\uD83D\uDC2E','\uD83D\uDC37','\uD83D\uDC38','\uD83D\uDC35','\uD83D\uDC14','\uD83D\uDC27','\uD83D\uDC26','\uD83E\uDD84','\uD83D\uDC1D','\uD83D\uDC1B','\uD83E\uDD8B','\uD83D\uDC0C','\uD83D\uDC1E','\uD83E\uDD81','\uD83D\uDC35','\uD83D\uDC12','\uD83E\uDD8D','\uD83E\uDDA7','\uD83D\uDC3A','\uD83D\uDC34','\uD83E\uDECE','\uD83E\uDECF','\uD83E\uDD93','\uD83E\uDD8C','\uD83D\uDC2E','\uD83D\uDC02','\uD83D\uDC03','\uD83D\uDC04','\uD83D\uDC37','\uD83D\uDC16','\uD83D\uDC17','\uD83D\uDC0F','\uD83D\uDC11','\uD83D\uDC10','\uD83D\uDC2A','\uD83D\uDC2B','\uD83E\uDD99','\uD83E\uDD92','\uD83D\uDC18','\uD83E\uDDA3','\uD83E\uDD8F','\uD83E\uDD9B','\uD83D\uDC01','\uD83D\uDC00','\uD83D\uDC3F\uFE0F','\uD83E\uDDAB','\uD83E\uDD94','\uD83E\uDD87','\uD83D\uDC3B\u200D\u2744\uFE0F','\uD83D\uDC28','\uD83D\uDC3C','\uD83E\uDDA5','\uD83E\uDDA6','\uD83E\uDDA8','\uD83E\uDD98','\uD83E\uDDA1','\uD83D\uDC3E','\uD83E\uDD83','\uD83D\uDC13','\uD83E\uDD86','\uD83E\uDD85','\uD83E\uDD89','\uD83E\uDDA4','\uD83E\uDEB6','\uD83E\uDDA9','\uD83E\uDD9A','\uD83E\uDD9C','\uD83D\uDC26\u200D\u2B1B','\uD83E\uDEBF','\uD83D\uDC26\u200D\uD83D\uDD25','\uD83D\uDC38','\uD83D\uDC0A','\uD83D\uDC22','\uD83E\uDD8E','\uD83D\uDC0D','\uD83D\uDC32','\uD83D\uDC09','\uD83E\uDD95','\uD83E\uDD96','\uD83D\uDC33','\uD83D\uDC0B','\uD83D\uDC2C','\uD83E\uDDAD','\uD83D\uDC1F','\uD83D\uDC20','\uD83D\uDC21','\uD83E\uDD88','\uD83D\uDC19','\uD83D\uDC1A','\uD83E\uDEB8','\uD83E\uDEBC','\uD83E\uDD80','\uD83E\uDD9E','\uD83E\uDD90','\uD83E\uDD91','\uD83E\uDDAA','\uD83E\uDEB2','\uD83E\uDEB3','\uD83E\uDD9F','\uD83E\uDEB0','\uD83E\uDEB1','\uD83E\uDDA0','\uD83C\uDF0D','\uD83C\uDF0E','\uD83C\uDF0F','\uD83C\uDF15','\uD83C\uDF19','\u2B50','\uD83C\uDF1F','\uD83D\uDCAB','\u2728','\u26A1','\uD83D\uDD25','\uD83D\uDCAF','\uD83C\uDF2A\uFE0F','\uD83C\uDF08','\u2600\uFE0F','\u26C5','\u2601\uFE0F','\uD83C\uDF27\uFE0F','\u26C8\uFE0F','\uD83C\uDF28\uFE0F','\u2744\uFE0F','\u2603\uFE0F','\uD83D\uDCA7','\uD83C\uDF0A'],
      '\uD83D\uDE97': ['\uD83D\uDE97','\uD83D\uDE95','\uD83D\uDE99','\uD83D\uDE8C','\uD83D\uDE8E','\uD83C\uDFCE\uFE0F','\uD83D\uDE93','\uD83D\uDE91','\uD83D\uDE92','\uD83D\uDE90','\uD83D\uDEFB','\uD83D\uDE9A','\uD83D\uDE9B','\uD83D\uDE9C','\uD83E\uDDAF','\uD83E\uDDBD','\uD83E\uDDBC','\uD83D\uDEF4','\uD83D\uDEB2','\uD83D\uDEF5','\uD83C\uDFCD\uFE0F','\uD83D\uDEFA','\uD83D\uDEA8','\uD83D\uDE94','\uD83D\uDE8D','\uD83D\uDE98','\uD83D\uDE96','\uD83D\uDEA1','\uD83D\uDEA0','\uD83D\uDE9F','\uD83D\uDE83','\uD83D\uDE8B','\uD83D\uDE9E','\uD83D\uDE9D','\uD83D\uDE84','\uD83D\uDE85','\uD83D\uDE88','\uD83D\uDE82','\uD83D\uDE86','\uD83D\uDE87','\uD83D\uDE8A','\uD83D\uDE89','\u2708\uFE0F','\uD83D\uDEEB','\uD83D\uDEEC','\uD83D\uDEE9\uFE0F','\uD83D\uDCBA','\uD83D\uDE81','\uD83D\uDE9F','\uD83D\uDE80','\uD83D\uDEF8','\u26F5','\uD83D\uDEA4','\uD83D\uDEE5\uFE0F','\uD83D\uDEF3\uFE0F','\u26F4\uFE0F','\uD83D\uDEA2','\u2693','\uD83D\uDEDF','\uD83E\uDE9D','\u26FD','\uD83D\uDEA7','\uD83D\uDEA6','\uD83D\uDEA5','\uD83D\uDDFA\uFE0F','\uD83D\uDDFF','\uD83D\uDDFD','\uD83D\uDDFC','\uD83C\uDFF0','\uD83C\uDFEF','\uD83C\uDFDF\uFE0F','\uD83C\uDFA1','\uD83C\uDFA2','\uD83C\uDFA0','\u26F2','\u26F1\uFE0F','\uD83C\uDFD6\uFE0F','\uD83C\uDFDD\uFE0F','\uD83C\uDFDC\uFE0F','\uD83C\uDF0B','\u26F0\uFE0F','\uD83C\uDFD4\uFE0F','\uD83D\uDDFB','\uD83C\uDFD5\uFE0F','\u26FA','\uD83D\uDED6','\uD83C\uDFE0','\uD83C\uDFE1','\uD83C\uDFD8\uFE0F','\uD83C\uDFDA\uFE0F','\uD83C\uDFD7\uFE0F','\uD83C\uDFED','\uD83C\uDFE2','\uD83C\uDFEC','\uD83C\uDFE3','\uD83C\uDFE4','\uD83C\uDFE5','\uD83C\uDFE6','\uD83C\uDFE8','\uD83C\uDFEA','\uD83C\uDFEB','\uD83C\uDFE9','\uD83D\uDC92','\uD83C\uDFDB\uFE0F','\u26EA','\uD83D\uDD4C','\uD83D\uDD4D','\uD83D\uDED5','\uD83D\uDD4B'],
      '\uD83D\uDCA1': ['\uD83D\uDCA1','\uD83D\uDD26','\uD83C\uDFEE','\uD83E\uDE94','\uD83D\uDCF1','\uD83D\uDCF2','\u260E\uFE0F','\uD83D\uDCDE','\uD83D\uDCDF','\uD83D\uDCE0','\uD83D\uDD0B','\uD83E\uDEAB','\uD83D\uDD0C','\uD83D\uDCBB','\uD83D\uDDA5\uFE0F','\uD83D\uDDA8\uFE0F','\u2328\uFE0F','\uD83D\uDDB1\uFE0F','\uD83D\uDDB2\uFE0F','\uD83D\uDCBD','\uD83D\uDCBE','\uD83D\uDCBF','\uD83D\uDCC0','\uD83E\uDDEE','\uD83C\uDFA5','\uD83C\uDF9E\uFE0F','\uD83D\uDCFD\uFE0F','\uD83D\uDCFA','\uD83D\uDCF7','\uD83D\uDCF8','\uD83D\uDCF9','\uD83D\uDCFC','\uD83D\uDD0D','\uD83D\uDD0E','\uD83D\uDD6F\uFE0F','\uD83D\uDCD4','\uD83D\uDCD5','\uD83D\uDCD6','\uD83D\uDCD7','\uD83D\uDCD8','\uD83D\uDCD9','\uD83D\uDCDA','\uD83D\uDCD3','\uD83D\uDCD2','\uD83D\uDCC3','\uD83D\uDCDC','\uD83D\uDCC4','\uD83D\uDCF0','\uD83D\uDDDE\uFE0F','\uD83D\uDCD1','\uD83D\uDD16','\uD83C\uDFF7\uFE0F','\uD83D\uDCB0','\uD83E\uDE99','\uD83D\uDCB4','\uD83D\uDCB5','\uD83D\uDCB6','\uD83D\uDCB7','\uD83D\uDCB8','\uD83D\uDCB3','\uD83E\uDDFE','\uD83D\uDC8E','\u2696\uFE0F','\uD83E\uDE9C','\uD83E\uDDF0','\uD83E\uDE9B','\uD83D\uDD27','\uD83D\uDD28','\u2692\uFE0F','\uD83D\uDEE0\uFE0F','\u26CF\uFE0F','\uD83E\uDE9A','\uD83D\uDD29','\u2699\uFE0F','\uD83E\uDEA4','\uD83E\uDDF1','\u26D3\uFE0F','\uD83E\uDDF2','\uD83D\uDD2B','\uD83D\uDCA3','\uD83E\uDDE8','\uD83E\uDE93','\uD83D\uDD2A','\uD83D\uDDE1\uFE0F','\u2694\uFE0F','\uD83D\uDEE1\uFE0F','\uD83D\uDEAC','\u26B0\uFE0F','\uD83E\uDEA6','\u26B1\uFE0F','\uD83C\uDFFA','\uD83D\uDD2E','\uD83D\uDCFF','\uD83E\uDDFF','\uD83E\uDEAC','\uD83D\uDC88','\u2697\uFE0F','\uD83D\uDD2D','\uD83D\uDD2C','\uD83D\uDD73\uFE0F','\uD83E\uDE79','\uD83E\uDE7A','\uD83D\uDC8A','\uD83D\uDC89','\uD83E\uDE78','\uD83E\uDDEC','\uD83E\uDDA0','\uD83E\uDDEB','\uD83E\uDDEA','\uD83C\uDF21\uFE0F','\uD83E\uDDF9','\uD83E\uDDFA','\uD83E\uDDFB','\uD83D\uDEBD','\uD83D\uDEBF','\uD83D\uDEC1','\uD83D\uDECB\uFE0F','\uD83E\uDE91','\uD83D\uDECF\uFE0F','\uD83E\uDE9E','\uD83E\uDE9F','\uD83E\uDDF4','\uD83E\uDDF7','\uD83E\uDDF8','\uD83D\uDDBC\uFE0F','\uD83D\uDECD\uFE0F','\uD83D\uDED2','\uD83C\uDF81','\uD83C\uDF88','\uD83C\uDF8F','\uD83C\uDF80','\uD83E\uDE84','\uD83E\uDE85','\uD83C\uDF8A','\uD83C\uDF89'],
      '\uD83D\uDD23': ['\uD83D\uDCAF','\uD83D\uDD22','#\uFE0F\u20E3','*\uFE0F\u20E3','0\uFE0F\u20E3','1\uFE0F\u20E3','2\uFE0F\u20E3','3\uFE0F\u20E3','4\uFE0F\u20E3','5\uFE0F\u20E3','6\uFE0F\u20E3','7\uFE0F\u20E3','8\uFE0F\u20E3','9\uFE0F\u20E3','\uD83D\uDD1F','\u203C\uFE0F','\u2049\uFE0F','\u2753','\u2754','\u2755','\u2757','\u3030\uFE0F','\u27B0','\u27BF','\u2764\uFE0F\u200D\uD83D\uDD25','\uD83D\uDC94','\u2764\uFE0F\u200D\uD83E\uDE79','\u2705','\u2611\uFE0F','\u2714\uFE0F','\u274C','\u274E','\u2795','\u2796','\u2797','\u2716\uFE0F','\uD83D\uDFF0','\u267E\uFE0F','\u2122\uFE0F','\u00A9\uFE0F','\u00AE\uFE0F','\u303D\uFE0F','\u26A0\uFE0F','\uD83D\uDEB8','\uD83D\uDD31','\u269C\uFE0F','\uD83D\uDD30','\u267B\uFE0F','\u2705','\uD83C\uDE2F','\uD83D\uDCB9','\u2747\uFE0F','\u2733\uFE0F','\u274E','\uD83C\uDF10','\uD83D\uDCA0','\u24C2\uFE0F','\uD83C\uDF00','\uD83D\uDCA4','\uD83C\uDFE7','\uD83D\uDEBE','\u267F','\uD83C\uDD7F\uFE0F','\uD83D\uDED7','\uD83C\uDE33','\uD83C\uDE02\uFE0F','\uD83D\uDEC2','\uD83D\uDEC3','\uD83D\uDEC4','\uD83D\uDEC5','\uD83D\uDEB9','\uD83D\uDEBA','\uD83D\uDEBC','\u26A7\uFE0F','\uD83D\uDEBB','\uD83D\uDEAE','\uD83C\uDFA6','\uD83D\uDCF6','\uD83C\uDE01','\uD83D\uDD23','\u2139\uFE0F','\uD83D\uDD24','\uD83D\uDD21','\uD83D\uDD20','\uD83C\uDD96','\uD83C\uDD97','\uD83C\uDD99','\uD83C\uDD92','\uD83C\uDD95','\uD83C\uDD93','0\uFE0F\u20E3','1\uFE0F\u20E3','2\uFE0F\u20E3','\uD83D\uDFE5','\uD83D\uDFE7','\uD83D\uDFE8','\uD83D\uDFE9','\uD83D\uDFE6','\uD83D\uDFEA','\u2B1B','\u2B1C','\uD83D\uDFEB','\uD83D\uDD34','\uD83D\uDFE0','\uD83D\uDFE1','\uD83D\uDFE2','\uD83D\uDD35','\uD83D\uDFE3','\u26AB','\u26AA','\uD83D\uDFE4','\uD83D\uDD3A','\uD83D\uDD3B','\uD83D\uDD38','\uD83D\uDD39','\uD83D\uDD36','\uD83D\uDD37','\uD83D\uDD33','\uD83D\uDD32'],
      '\uD83C\uDFF3\uFE0F': ['\uD83C\uDFF3\uFE0F','\uD83C\uDFF4','\uD83C\uDFC1','\uD83D\uDEA9','\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08','\uD83C\uDFF3\uFE0F\u200D\u26A7\uFE0F','\uD83C\uDFF4\u200D\u2620\uFE0F','\uD83C\uDDFA\uD83C\uDDF3','\uD83C\uDDF7\uD83C\uDDFA','\uD83C\uDDFA\uD83C\uDDF8','\uD83C\uDDEC\uD83C\uDDE7','\uD83C\uDDE9\uD83C\uDDEA','\uD83C\uDDEB\uD83C\uDDF7','\uD83C\uDDEA\uD83C\uDDF8','\uD83C\uDDEE\uD83C\uDDF9','\uD83C\uDDF5\uD83C\uDDF9','\uD83C\uDDF3\uD83C\uDDF1','\uD83C\uDDE7\uD83C\uDDEA','\uD83C\uDDE8\uD83C\uDDED','\uD83C\uDDE6\uD83C\uDDF9','\uD83C\uDDF5\uD83C\uDDF1','\uD83C\uDDE8\uD83C\uDDFF','\uD83C\uDDF8\uD83C\uDDF0','\uD83C\uDDFA\uD83C\uDDE6','\uD83C\uDDE7\uD83C\uDDFE','\uD83C\uDDF0\uD83C\uDDFF','\uD83C\uDDEC\uD83C\uDDEA','\uD83C\uDDE6\uD83C\uDDF2','\uD83C\uDDE6\uD83C\uDDFF','\uD83C\uDDF9\uD83C\uDDF7','\uD83C\uDDEC\uD83C\uDDF7','\uD83C\uDDE7\uD83C\uDDEC','\uD83C\uDDF7\uD83C\uDDF4','\uD83C\uDDED\uD83C\uDDFA','\uD83C\uDDEB\uD83C\uDDEE','\uD83C\uDDF8\uD83C\uDDEA','\uD83C\uDDF3\uD83C\uDDF4','\uD83C\uDDE9\uD83C\uDDF0','\uD83C\uDDEE\uD83C\uDDF8','\uD83C\uDDEE\uD83C\uDDEA','\uD83C\uDDE8\uD83C\uDDE6','\uD83C\uDDF2\uD83C\uDDFD','\uD83C\uDDE7\uD83C\uDDF7','\uD83C\uDDE6\uD83C\uDDF7','\uD83C\uDDE8\uD83C\uDDF1','\uD83C\uDDE8\uD83C\uDDF4','\uD83C\uDDF5\uD83C\uDDEA','\uD83C\uDDEF\uD83C\uDDF5','\uD83C\uDDF0\uD83C\uDDF7','\uD83C\uDDE8\uD83C\uDDF3','\uD83C\uDDEE\uD83C\uDDF3','\uD83C\uDDEE\uD83C\uDDE9','\uD83C\uDDF9\uD83C\uDDED','\uD83C\uDDFB\uD83C\uDDF3','\uD83C\uDDF5\uD83C\uDDED','\uD83C\uDDF8\uD83C\uDDEC','\uD83C\uDDE6\uD83C\uDDFA','\uD83C\uDDF3\uD83C\uDDFF','\uD83C\uDDFF\uD83C\uDDE6','\uD83C\uDDEA\uD83C\uDDEC','\uD83C\uDDEE\uD83C\uDDF1','\uD83C\uDDE6\uD83C\uDDEA','\uD83C\uDDF8\uD83C\uDDE6'],
    };
    const RECENT_EMOJI_CATEGORY = '\uD83D\uDD58';
    const RECENT_EMOJI_LIMIT = 32;
    const RECENT_EMOJI_STORAGE_PREFIX = 'bananza:recentEmojis:v1';
    let recentEmojis = [];
    let recentEmojiLoadPromise = null;
    let emojiPickerInitialized = false;
    const recentEmojiServerRejected = new Set();
    const recentEmojiServerSynced = new Set();
    const recentEmojiServerSyncing = new Set();

    const CUSTOM_EMOJI_CATALOGS = customEmoji.CUSTOM_EMOJI_CATALOGS || [];
    const getCustomEmoji = customEmoji.getCustomEmoji || (() => null);
    const getCustomEmojiCatalog = customEmoji.getCustomEmojiCatalog || (() => null);
    const isCustomEmojiToken = customEmoji.isCustomEmojiToken || (() => false);
    const renderCustomEmojiHtml = customEmoji.renderCustomEmojiHtml || ((token) => esc(token));

    function normalizeRecentEmojiValue(value) {
      return (customEmoji.serializeComposerTextValue || ((nextValue, { trim = false } = {}) => (trim ? String(nextValue || '').trim() : String(nextValue || ''))))(String(value || ''), { trim: true });
    }

    function isValidRecentEmojiValue(value) {
      const emoji = normalizeRecentEmojiValue(value);
      return Boolean(emoji && (isCustomEmojiToken(emoji) || (actions.isSingleEmojiMessage || (() => false))(emoji)));
    }

    function normalizeRecentEmojiList(value) {
      if (!Array.isArray(value)) return [];
      const seen = new Set();
      const list = [];
      value.forEach((item) => {
        const emoji = normalizeRecentEmojiValue(item);
        if (!emoji || !isValidRecentEmojiValue(emoji) || seen.has(emoji)) return;
        seen.add(emoji);
        list.push(emoji);
      });
      return list.slice(0, RECENT_EMOJI_LIMIT);
    }

    function mergeRecentEmojiLists(...lists) {
      return normalizeRecentEmojiList(lists.flatMap((list) => (Array.isArray(list) ? list : [])));
    }

    function getRecentEmojiStorageKey(userId = getCurrentUser()?.id) {
      const id = Number(userId || 0);
      return Number.isFinite(id) && id > 0 ? `${RECENT_EMOJI_STORAGE_PREFIX}:${id}` : '';
    }

    function loadLocalRecentEmojis() {
      const key = getRecentEmojiStorageKey();
      if (!key) return [];
      try {
        return normalizeRecentEmojiList(JSON.parse(storage.getItem(key) || '[]'));
      } catch (error) {
        storage.removeItem(key);
        return [];
      }
    }

    function persistLocalRecentEmojis(list = recentEmojis) {
      const key = getRecentEmojiStorageKey();
      if (!key) return;
      const normalized = normalizeRecentEmojiList(list);
      try {
        if (normalized.length) storage.setItem(key, JSON.stringify(normalized));
        else storage.removeItem(key);
      } catch (error) {}
    }

    function getEmojiPickerCategories() {
      const cats = Object.keys(EMOJIS);
      const customCats = CUSTOM_EMOJI_CATALOGS.map((catalog) => catalog.id);
      if (!cats.length) return [RECENT_EMOJI_CATEGORY, ...customCats];
      return [cats[0], RECENT_EMOJI_CATEGORY, ...cats.slice(1), ...customCats];
    }

    function getRecentEmojiCategory() {
      return RECENT_EMOJI_CATEGORY;
    }

    function getCustomEmojiCatalogForCategory(category) {
      return getCustomEmojiCatalog(category);
    }

    function isCustomEmojiCategory(category) {
      return Boolean(getCustomEmojiCatalogForCategory(category));
    }

    function getEmojiCategoryItems(category) {
      if (category === RECENT_EMOJI_CATEGORY) return recentEmojis;
      const customCatalog = getCustomEmojiCatalogForCategory(category);
      if (customCatalog) return customCatalog.items.map((item) => item.token);
      return EMOJIS[category] || [];
    }

    function getEmojiCategoryLabel(category) {
      const customCatalog = getCustomEmojiCatalogForCategory(category);
      return customCatalog ? t(customCatalog.label) : category;
    }

    function emojiCategoryHasCustomEmojiItems(category) {
      return getEmojiCategoryItems(category).some((item) => isCustomEmojiToken(item));
    }

    function renderEmojiGridItemHtml(value) {
      const item = getCustomEmoji(value);
      if (item) {
        const legacyPickerClass = item.category === 'qip-infium-original' ? ' qip-infium-emoji-item' : '';
        const pickerImageClass = item.category === 'qip-infium-original'
          ? 'custom-emoji-img--picker qip-infium-emoji--picker'
          : 'custom-emoji-img--picker';
        return `<div class="emoji-item custom-emoji-item ${esc(item.category)}-emoji-item${legacyPickerClass}" data-emoji="${esc(item.token)}" title="${esc(item.label)}">${renderCustomEmojiHtml(item.token, { className: pickerImageClass, picker: true })}</div>`;
      }
      return `<div class="emoji-item" data-emoji="${esc(value)}">${esc(value)}</div>`;
    }

    function renderEmojiGridItemsHtml(category) {
      return getEmojiCategoryItems(category).map(renderEmojiGridItemHtml).join('');
    }

    function applyEmojiGridCategoryState(grid, category, { syncPicker = true } = {}) {
      const hasCustomItems = emojiCategoryHasCustomEmojiItems(category);
      const hasQipHdItems = category === 'qip-hd' && hasCustomItems;
      const hasQipOriginalItems = category === 'qip-infium-original' && hasCustomItems;
      grid?.classList?.toggle('has-custom-emoji-images', hasCustomItems);
      grid?.classList?.toggle('has-qip-hd-emojis', hasQipHdItems);
      grid?.classList?.toggle('has-qip-infium-emojis', hasQipOriginalItems);
      if (syncPicker) {
        dom.emojiPicker?.classList?.toggle('has-custom-emoji-images', hasCustomItems);
        dom.emojiPicker?.classList?.toggle('has-qip-hd-emojis', hasQipHdItems);
        dom.emojiPicker?.classList?.toggle('has-qip-infium-emojis', hasQipOriginalItems);
      }
    }

    function getEmojiPickerLiveGrid() {
      return dom.emojiPicker?.querySelector?.('.emoji-grid-swipe > .emoji-grid.horizontal-swipe-live')
        || dom.emojiPicker?.querySelector?.('.emoji-grid');
    }

    function createEmojiPickerGridElement(category) {
      const grid = doc.createElement('div');
      grid.className = 'emoji-grid';
      applyEmojiGridCategoryState(grid, category, { syncPicker: false });
      grid.innerHTML = renderEmojiGridItemsHtml(category);
      return grid;
    }

    function renderEmojiPickerGrid(category) {
      const grid = getEmojiPickerLiveGrid();
      if (!grid) return;
      applyEmojiGridCategoryState(grid, category);
      grid.innerHTML = renderEmojiGridItemsHtml(category);
    }

    function getActiveEmojiPickerCategory() {
      return dom.emojiPicker?.querySelector?.('.emoji-tab.active')?.dataset?.cat || '';
    }

    function centerEmojiPickerActiveCategory({ behavior = 'auto' } = {}) {
      const tabs = dom.emojiPicker?.querySelector?.('.emoji-tabs');
      return (actions.scheduleScrollableItemCenter || noop)(tabs, '.emoji-tab.active', { behavior });
    }

    function setEmojiPickerCategory(category, { reposition = true, centerBehavior = 'auto' } = {}) {
      const cats = getEmojiPickerCategories();
      const nextCategory = cats.includes(category) ? category : (cats[0] || RECENT_EMOJI_CATEGORY);
      dom.emojiPicker?.querySelectorAll?.('.emoji-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.cat === nextCategory);
      });
      renderEmojiPickerGrid(nextCategory);
      centerEmojiPickerActiveCategory({ behavior: centerBehavior });
      if (reposition) positionEmojiPicker();
      return nextCategory;
    }

    function updateRecentEmojiGridIfActive() {
      if (typeof doc === 'undefined' || !dom.emojiPicker?.isConnected) return;
      if (getActiveEmojiPickerCategory() === RECENT_EMOJI_CATEGORY) {
        renderEmojiPickerGrid(RECENT_EMOJI_CATEGORY);
        positionEmojiPicker();
      }
    }

    function applyRecentEmojis(list, { persist = true } = {}) {
      recentEmojis = normalizeRecentEmojiList(list);
      if (persist) persistLocalRecentEmojis(recentEmojis);
      updateRecentEmojiGridIfActive();
    }

    function syncMissingRecentEmojisToServer(list, serverList = []) {
      const serverSet = new Set(normalizeRecentEmojiList(serverList));
      const missing = normalizeRecentEmojiList(list)
        .filter((emoji) => !serverSet.has(emoji) && !recentEmojiServerRejected.has(emoji) && !recentEmojiServerSynced.has(emoji));
      if (!missing.length) return;
      missing.slice().reverse().forEach((emoji) => {
        syncRecentEmojiToServer(emoji, 'backfill');
      });
    }

    function isInvalidRecentEmojiApiError(error) {
      return error?.status === 400 && String(error?.serverError || error?.message || '') === 'Invalid emoji';
    }

    function syncRecentEmojiToServer(emoji, reason) {
      const value = normalizeRecentEmojiValue(emoji);
      if (!value || recentEmojiServerRejected.has(value) || recentEmojiServerSynced.has(value) || recentEmojiServerSyncing.has(value)) {
        return Promise.resolve(null);
      }
      recentEmojiServerSyncing.add(value);
      return api('/api/user/recent-emojis', { method: 'POST', body: { emoji: value } })
        .then((data) => {
          recentEmojiServerSynced.add(value);
          return data;
        })
        .catch((error) => {
          if (isInvalidRecentEmojiApiError(error)) {
            recentEmojiServerRejected.add(value);
            return null;
          }
          console.warn(`[emoji] recent ${reason} failed:`, error);
          return null;
        })
        .finally(() => {
          recentEmojiServerSyncing.delete(value);
        });
    }

    function rememberRecentEmoji(emoji, { sync = true } = {}) {
      const value = normalizeRecentEmojiValue(emoji);
      if (!value || !isValidRecentEmojiValue(value)) return;
      applyRecentEmojis(mergeRecentEmojiLists([value], recentEmojis));
      if (!sync) return;
      syncRecentEmojiToServer(value, 'save')
        .then((data) => {
          if (data?.emojis) applyRecentEmojis(mergeRecentEmojiLists([value], recentEmojis, data.emojis));
        });
    }

    function loadRecentEmojis() {
      if (recentEmojiLoadPromise) return recentEmojiLoadPromise;
      recentEmojiLoadPromise = (async () => {
        const localRecent = loadLocalRecentEmojis();
        if (localRecent.length) applyRecentEmojis(localRecent, { persist: false });
        try {
          const data = await api('/api/user/recent-emojis');
          const serverRecent = normalizeRecentEmojiList(data?.emojis || []);
          const merged = mergeRecentEmojiLists(localRecent, serverRecent);
          applyRecentEmojis(merged);
          syncMissingRecentEmojisToServer(merged, serverRecent);
        } catch (error) {
          console.warn('[emoji] recent load failed:', error);
          applyRecentEmojis(localRecent);
        }
      })().finally(() => {
        recentEmojiLoadPromise = null;
      });
      return recentEmojiLoadPromise;
    }

    function shouldKeepEmojiPickerKeyboard() {
      return Boolean(state.emojiPickerKeyboardAttached || (actions.isMobileComposerKeyboardOpen || (() => false))());
    }

    function clearEmojiPickerKeyboardOpenStabilizer() {
      if (state.emojiPickerKeyboardStabilizeFrame) {
        win.cancelAnimationFrame(state.emojiPickerKeyboardStabilizeFrame);
        state.emojiPickerKeyboardStabilizeFrame = 0;
      }
      if (state.emojiPickerKeyboardStabilizeTimer) {
        win.clearTimeout(state.emojiPickerKeyboardStabilizeTimer);
        state.emojiPickerKeyboardStabilizeTimer = null;
      }
    }

    function stabilizeEmojiPickerKeyboardOnOpen(keepKeyboardOpen = state.emojiPickerKeyboardAttached) {
      if (!(actions.isMobileLayoutViewport || (() => false))() || !keepKeyboardOpen) return false;
      clearEmojiPickerKeyboardOpenStabilizer();
      const apply = () => {
        if (!state.emojiPickerOpen || !shouldKeepEmojiPickerKeyboard()) return false;
        (actions.focusComposerKeepKeyboard || noop)(true);
        (actions.forceMobileViewportLayoutSync || noop)();
        (actions.syncChatAreaMetrics || noop)();
        (actions.queueIosViewportLayoutSync || noop)();
        return true;
      };
      state.emojiPickerKeyboardStabilizeFrame = win.requestAnimationFrame(() => {
        state.emojiPickerKeyboardStabilizeFrame = 0;
        apply();
      });
      state.emojiPickerKeyboardStabilizeTimer = win.setTimeout(() => {
        state.emojiPickerKeyboardStabilizeTimer = null;
        apply();
      }, 150);
      return true;
    }

    function initEmojiPicker(options = {}) {
      const force = Boolean(objectOrDefault(options).force);
      const emojiPicker = dom.emojiPicker;
      if (!emojiPicker) return false;
      if (emojiPickerInitialized && !force) {
        syncEmojiPickerButton();
        return true;
      }
      const cats = getEmojiPickerCategories();
      let html = '<div class="emoji-tabs">';
      cats.forEach((cat, index) => {
        const tabClasses = `emoji-tab${index === 0 ? ' active' : ''}${isCustomEmojiCategory(cat) ? ' custom-emoji-tab' : ''}${cat === 'qip-infium-original' ? ' qip-infium-emoji-tab' : ''}`;
        html += `<div class="${tabClasses}" data-cat="${esc(cat)}">${esc(getEmojiCategoryLabel(cat))}</div>`;
      });
      html += '</div><div class="emoji-grid-swipe horizontal-swipe-surface"><div class="emoji-grid horizontal-swipe-live">';
      html += renderEmojiGridItemsHtml(cats[0]);
      html += '</div></div>';
      emojiPicker.innerHTML = html;
      applyEmojiGridCategoryState(getEmojiPickerLiveGrid(), cats[0]);
      syncEmojiPickerButton();

      state.emojiSwipePager?.destroy?.();
      state.emojiSwipePager = (actions.createHorizontalSwipePager || (() => null))({
        root: emojiPicker.querySelector('.emoji-grid-swipe'),
        getKeys: () => getEmojiPickerCategories(),
        getActiveKey: () => getActiveEmojiPickerCategory(),
        setActiveKey: (category, meta = {}) => {
          setEmojiPickerCategory(category, {
            reposition: false,
            centerBehavior: meta.source === 'swipe' ? 'smooth' : 'auto',
          });
        },
        renderPage: (category) => createEmojiPickerGridElement(category),
        isAvailable: () => (actions.isFloatingSurfaceVisible || (() => false))(emojiPicker),
        onSettled: (_category, meta = {}) => {
          centerEmojiPickerActiveCategory({ behavior: meta.source === 'swipe' ? 'smooth' : 'auto' });
          positionEmojiPicker();
        },
      });

      emojiPickerInitialized = true;
      if (emojiPicker.__composerEmojiPickerBound) return true;
      emojiPicker.__composerEmojiPickerBound = true;
      const isEmojiPickerScrollSurface = (target) => Boolean(
        target instanceof win.Element
        && (
          target.classList.contains('emoji-grid')
          || target.classList.contains('emoji-grid-swipe')
          || target.classList.contains('emoji-tabs')
        )
      );
      const keepEmojiPickerInteractionFromBlurringInput = (event) => {
        if (event.type === 'touchstart' || event.type === 'touchmove') return;
        if (isEmojiPickerScrollSurface(event.target)) return;
        if (shouldKeepEmojiPickerKeyboard()) (actions.preventMobileComposerBlur || noop)(event);
      };

      emojiPicker.addEventListener('pointerdown', (event) => {
        keepEmojiPickerInteractionFromBlurringInput(event);
        event.stopPropagation();
      });
      emojiPicker.addEventListener('touchstart', (event) => {
        event.stopPropagation();
      }, { passive: true });
      emojiPicker.addEventListener('touchmove', (event) => {
        event.stopPropagation();
      }, { passive: true });
      emojiPicker.addEventListener('mousedown', (event) => {
        keepEmojiPickerInteractionFromBlurringInput(event);
        if (!isEmojiPickerScrollSurface(event.target)) event.preventDefault();
        event.stopPropagation();
      });

      emojiPicker.addEventListener('click', (event) => {
        event.stopPropagation();
        const tab = event.target.closest('.emoji-tab');
        if (tab) {
          setEmojiPickerCategory(tab.dataset.cat || '');
          return;
        }
        const item = event.target.closest('.emoji-item');
        if (item) {
          const value = item.dataset.emoji || item.textContent || '';
          if (!value) return;
          const insertion = text.getEmojiPickerInsertionValue?.(value) || value;
          const msgInput = dom.msgInput;
          if (!msgInput) return;
          const inputValue = msgInput.value || '';
          const inputIsFocused = doc.activeElement === msgInput;
          if (inputIsFocused) text.snapComposerSelectionToCustomEmojiBoundary?.();
          const start = inputIsFocused
            ? Math.max(0, Math.min(inputValue.length, msgInput.selectionStart ?? inputValue.length))
            : inputValue.length;
          const end = inputIsFocused
            ? Math.max(start, Math.min(inputValue.length, msgInput.selectionEnd ?? start))
            : start;
          const before = inputValue.substring(0, start);
          const after = inputValue.substring(end);
          msgInput.value = before + insertion + after;
          msgInput.selectionStart = msgInput.selectionEnd = start + insertion.length;
          msgInput.dispatchEvent(new win.Event('input', { bubbles: true }));
          rememberRecentEmoji(value);
          if (!(actions.isMobileLayoutViewport || (() => false))() || shouldKeepEmojiPickerKeyboard()) {
            (actions.focusComposerKeepKeyboard || noop)(true);
          }
        }
      });
      return true;
    }

    function ensureEmojiPickerInitialized({ loadRecent = true } = {}) {
      if (!emojiPickerInitialized) {
        const localRecent = loadLocalRecentEmojis();
        if (localRecent.length) applyRecentEmojis(localRecent, { persist: false });
      }
      const initialized = initEmojiPicker();
      if (loadRecent) loadRecentEmojis().catch(() => {});
      return initialized;
    }

    function syncEmojiPickerButton() {
      if (!dom.emojiBtn) return;
      const isOpen = Boolean(state.emojiPickerOpen && (actions.isFloatingSurfaceVisible || (() => false))(dom.emojiPicker));
      dom.emojiBtn.classList.toggle('is-open', isOpen);
      dom.emojiBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function getEmojiPickerAnchorClientTop(anchor, anchorRect) {
      const row = dom.inputRow instanceof win.HTMLElement ? dom.inputRow : null;
      if (!row || !(anchor === dom.emojiBtn || row.contains(anchor))) return anchorRect.top;
      const rowRect = row.getBoundingClientRect?.();
      if (!rowRect || !Number.isFinite(rowRect.top) || !Number.isFinite(rowRect.bottom) || rowRect.bottom <= rowRect.top) {
        return anchorRect.top;
      }
      return Math.min(anchorRect.top, rowRect.top);
    }

    function positionEmojiPicker(anchorEl = state.emojiPickerAnchorEl || dom.emojiBtn) {
      const emojiPicker = dom.emojiPicker;
      if (!(emojiPicker instanceof win.HTMLElement) || !(actions.isFloatingSurfaceVisible || (() => false))(emojiPicker)) return;
      const anchor = anchorEl instanceof win.HTMLElement ? anchorEl : dom.emojiBtn;
      if (!(anchor instanceof win.HTMLElement)) return;
      const rect = anchor.getBoundingClientRect();
      const keyboardAttached = (actions.isMobileLayoutViewport || (() => false))() && shouldKeepEmojiPickerKeyboard();
      const viewport = keyboardAttached
        ? {
          left: 0,
          top: 0,
          width: win.visualViewport?.width || win.innerWidth,
          height: win.visualViewport?.height || win.innerHeight,
          right: win.visualViewport?.width || win.innerWidth,
          bottom: win.visualViewport?.height || win.innerHeight,
        }
        : (actions.getFloatingViewportRect || (() => ({ left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight, width: win.innerWidth, height: win.innerHeight })))();
      const pickerSize = (actions.measureFloatingSurface || ((_el, fallbackWidth, fallbackHeight) => ({ width: fallbackWidth, height: fallbackHeight })))(emojiPicker, 254, 338);
      if (keyboardAttached) {
        emojiPicker.style.maxHeight = `${Math.max(180, Math.round(viewport.height - 100))}px`;
      } else {
        emojiPicker.style.maxHeight = '';
      }
      const clamp = actions.clamp || ((value, min, max) => Math.max(min, Math.min(value, max)));
      const left = clamp(
        rect.left + viewport.left + ((rect.width - pickerSize.width) / 2),
        viewport.left + 8,
        viewport.right - pickerSize.width - 8
      );
      const anchorClientTop = getEmojiPickerAnchorClientTop(anchor, rect);
      let top = anchorClientTop + viewport.top - pickerSize.height - 8;
      if (keyboardAttached) {
        top = Math.min(top, anchorClientTop - pickerSize.height - 8);
      }
      top = clamp(top, viewport.top + 8, viewport.bottom - pickerSize.height - 8);
      (actions.positionFloatingElement || ((el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; }))(emojiPicker, left, top);
    }

    function openEmojiPicker(anchorEl = dom.emojiBtn, { keepKeyboardOpen } = {}) {
      ensureEmojiPickerInitialized();
      if (!(dom.emojiPicker instanceof win.HTMLElement)) return false;
      const keyboardAttached = typeof keepKeyboardOpen === 'boolean'
        ? keepKeyboardOpen
        : (!(actions.isMobileLayoutViewport || (() => false))() || (actions.isMobileComposerKeyboardOpen || (() => false))());
      state.emojiPickerAnchorEl = anchorEl instanceof win.HTMLElement ? anchorEl : dom.emojiBtn;
      state.emojiPickerKeyboardAttached = keyboardAttached;
      state.emojiPickerOpen = true;
      (actions.openFloatingSurface || ((el) => el?.classList.remove('hidden')))(dom.emojiPicker);
      syncEmojiPickerButton();
      positionEmojiPicker(state.emojiPickerAnchorEl);
      win.requestAnimationFrame(() => positionEmojiPicker(state.emojiPickerAnchorEl));
      stabilizeEmojiPickerKeyboardOnOpen(keyboardAttached);
      return true;
    }

    function closeEmojiPicker({ immediate = false } = {}) {
      state.emojiPickerOpen = false;
      clearEmojiPickerKeyboardOpenStabilizer();
      syncEmojiPickerButton();
      return (actions.closeFloatingSurface || ((el) => el?.classList.add('hidden')))(dom.emojiPicker, {
        immediate,
        onAfterClose: () => {
          state.emojiSwipePager?.reset?.();
          state.emojiPickerKeyboardAttached = false;
          state.emojiPickerAnchorEl = null;
          if (dom.emojiPicker instanceof win.HTMLElement) {
            dom.emojiPicker.style.left = '';
            dom.emojiPicker.style.top = '';
            dom.emojiPicker.style.maxHeight = '';
          }
          syncEmojiPickerButton();
        },
      });
    }

    function isEventInsideEmojiPickerSurface(event) {
      const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
      if (path.includes(dom.emojiPicker) || path.includes(dom.emojiBtn)) return true;
      const target = event?.target;
      return Boolean(
        target instanceof win.Node
        && (
          dom.emojiPicker?.contains?.(target)
          || dom.emojiBtn?.contains?.(target)
        )
      );
    }

    function dismissEmojiPickerOutsideGesture(event) {
      if (!(actions.isFloatingSurfaceVisible || (() => false))(dom.emojiPicker)) return;
      if (event?.type === 'pointerdown' && typeof event.button === 'number' && event.button !== 0) return;
      if (isEventInsideEmojiPickerSurface(event)) return;
      closeEmojiPicker();
    }

    function toggleEmojiPicker(anchorEl = dom.emojiBtn, options = {}) {
      if ((actions.isFloatingSurfaceVisible || (() => false))(dom.emojiPicker)) {
        closeEmojiPicker();
        return false;
      }
      openEmojiPicker(anchorEl, options);
      return true;
    }

    return {
      normalizeRecentEmojiValue,
      isValidRecentEmojiValue,
      normalizeRecentEmojiList,
      mergeRecentEmojiLists,
      getRecentEmojiStorageKey,
      getRecentEmojiCategory,
      loadLocalRecentEmojis,
      persistLocalRecentEmojis,
      loadRecentEmojis,
      rememberRecentEmoji,
      syncRecentEmojiToServer,
      getEmojiPickerCategories,
      getCustomEmojiCatalog: getCustomEmojiCatalogForCategory,
      isCustomEmojiCategory,
      getEmojiCategoryItems,
      getEmojiCategoryLabel,
      renderEmojiGridItemHtml,
      renderEmojiGridItemsHtml,
      renderEmojiPickerGrid,
      setEmojiPickerCategory,
      initEmojiPicker,
      ensureEmojiPickerInitialized,
      syncEmojiPickerButton,
      positionEmojiPicker,
      openEmojiPicker,
      closeEmojiPicker,
      toggleEmojiPicker,
      shouldKeepEmojiPickerKeyboard,
      clearEmojiPickerKeyboardOpenStabilizer,
      stabilizeEmojiPickerKeyboardOnOpen,
      dismissEmojiPickerOutsideGesture,
      isEventInsideEmojiPickerSurface,
      getActiveEmojiPickerCategory,
      centerEmojiPickerActiveCategory,
      applyRecentEmojis,
    };
  }

  composerRoot.emojiPicker = {
    createEmojiPickerController,
  };
})();
