import { Redis } from '@upstash/redis';

// Lê as variáveis de ambiente que a Vercel injeta automaticamente
// quando você conecta um banco Upstash pelo Marketplace.
// Aceita tanto o padrão novo (KV_REST_API_*) quanto o antigo (UPSTASH_REDIS_REST_*).
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
if (url && token) {
  redis = new Redis({ url, token });
}

const CHAVE = 'bolao:participantes';

export default async function handler(req, res) {
  // Permite chamadas vindas de qualquer origem (evita problemas de CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Se as variáveis de ambiente não existirem, avisa exatamente isso,
  // em vez de um erro genérico — assim fica fácil de diagnosticar.
  if (!redis) {
    return res.status(500).json({
      error: 'Banco de dados não configurado. Verifique se o Redis (Upstash) está conectado ao projeto na Vercel e se foi feito um redeploy depois de conectar.',
    });
  }

  try {
    if (req.method === 'GET') {
      const participantes = (await redis.get(CHAVE)) || [];
      return res.status(200).json({ participantes });
    }

    if (req.method === 'POST') {
      const { nome } = req.body || {};
      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        return res.status(400).json({ error: 'Nome inválido.' });
      }

      const participantes = (await redis.get(CHAVE)) || [];
      const novo = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        nome: nome.trim(),
        pontos: 0,
      };
      participantes.push(novo);
      await redis.set(CHAVE, participantes);

      return res.status(200).json({ participantes });
    }

    if (req.method === 'PATCH') {
      const { id, pontos } = req.body || {};
      if (!id || typeof pontos !== 'number') {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }

      const participantes = (await redis.get(CHAVE)) || [];
      const atualizado = participantes.map((p) =>
        p.id === id ? { ...p, pontos } : p
      );
      await redis.set(CHAVE, atualizado);

      return res.status(200).json({ participantes: atualizado });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};

      if (!id) {
        // sem id = zerar o placar inteiro
        await redis.set(CHAVE, []);
        return res.status(200).json({ participantes: [] });
      }

      const participantes = (await redis.get(CHAVE)) || [];
      const restantes = participantes.filter((p) => p.id !== id);
      await redis.set(CHAVE, restantes);

      return res.status(200).json({ participantes: restantes });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('Erro na função participantes:', err);
    return res.status(500).json({ error: 'Erro ao acessar o banco de dados.', detalhe: String(err) });
  }
}
