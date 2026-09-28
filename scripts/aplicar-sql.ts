/**
 * Aplica um arquivo .sql no Postgres de `SUPABASE_DB_URL`, em UMA transação.
 *
 *   npx tsx --env-file=.env scripts/aplicar-sql.ts supabase/migrations/NNNN_*.sql
 *
 * Existe porque o caminho que o kit usa para aplicar schema (`docker run
 * postgres:17-alpine psql`) depende do Docker estar de pé, e o Docker Desktop
 * cai. `pg` já é dependência do projeto — treze seeds abrem `pg.Pool` —, então
 * não há o que instalar.
 *
 * UMA TRANSAÇÃO, e isso é a razão de ser do script: migration aplicada pela
 * metade deixa o banco num estado que ninguém descreveu, e descobrir qual metade
 * passou custa mais que reaplicar. `ON_ERROR_STOP` sozinho não basta — ele para,
 * mas não desfaz.
 *
 * Não é um substituto do `update.sh` do kit: ele aplica o `baseline.sql` inteiro
 * e tolera os erros benignos de reaplicação. Este aqui aplica UM arquivo e falha
 * em qualquer erro.
 */
import { readFileSync } from "node:fs";

import { Client } from "pg";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: tsx --env-file=.env scripts/aplicar-sql.ts <arquivo.sql>");
  process.exit(2);
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL ausente no ambiente");
  process.exit(2);
}

const sql = readFileSync(arquivo, "utf8");

// O host aparece no log para não haver dúvida de em qual banco o DDL entrou —
// uma migration aplicada no banco errado é caro de descobrir depois.
const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).host;
console.info(`aplicando ${arquivo} em ${host}`);

const client = new Client({ connectionString: url });

async function main() {
  await client.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.info("aplicado (1 transação, commit)");
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(`falhou, nada foi aplicado: ${e.message}`);
  process.exit(1);
});
