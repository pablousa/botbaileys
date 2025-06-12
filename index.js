const {
  default: makeWASocket,
  useSingleFileAuthState
} = require('@whiskeysockets/baileys');
const fs = require('fs');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveState);

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return {};
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const loja = loadJSON('loja.json');
let userData = loadJSON('db.json');

sock.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || !msg.key.remoteJid) return;

  const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  if (!userData[sender]) {
    userData[sender] = { nome: sender, fichas: 300, inventario: [] };
    saveJSON('db.json', userData);
  }

  const send = (txt) => sock.sendMessage(jid, { text: txt });

  if (texto === '!saldo') {
    return send(`💰 Você tem ${userData[sender].fichas} fichas.`);
  }

  if (texto === '!inventario') {
    const inv = userData[sender].inventario;
    return send(`📦 Seu inventário: ${inv.length ? inv.join(', ') : 'vazio'}`);
  }

  if (texto === '!ajuda') {
    return send(`📜 Comandos disponíveis:
!saldo
!inventario
!comprar [item]
!vender [item]
!ajuda`);
  }

  if (texto.startsWith('!comprar ')) {
    const item = texto.split(' ')[1];
    const preco = loja[item];
    if (!preco) return send('❌ Item inexistente.');
    if (userData[sender].fichas < preco) return send('❌ Fichas insuficientes.');

    userData[sender].fichas -= preco;
    userData[sender].inventario.push(item);
    saveJSON('db.json', userData);
    return send(`✅ Você comprou "${item}" por ${preco} fichas.`);
  }

  if (texto.startsWith('!vender ')) {
    const item = texto.split(' ')[1];
    const idx = userData[sender].inventario.indexOf(item);
    if (idx === -1) return send('❌ Você não possui esse item.');

    const valor = Math.floor((loja[item] || 100) / 2);
    userData[sender].inventario.splice(idx, 1);
    userData[sender].fichas += valor;
    saveJSON('db.json', userData);
    return send(`💸 Você vendeu "${item}" por ${valor} fichas.`);
  }
});