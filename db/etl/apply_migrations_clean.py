"""
Script de Reset & Aplicação Canônica das Migrações V1 a V5 (SG Frotas)
Conecta ao PostgreSQL, reseta o schema antigo e aplica a nova linha limpa Flyway.
"""

import os
import time
import zlib
import ctypes
import psycopg2
from dotenv import dotenv_values

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MIGRATIONS_DIR = os.path.join(BASE_DIR, "db", "migrations")
RESET_SCRIPT = os.path.join(BASE_DIR, "db", "scripts", "reset_schema_frotas.sql")

def compute_checksum(filepath):
    with open(filepath, "rb") as f:
        data = f.read()
    crc = zlib.crc32(data)
    return ctypes.c_int32(crc).value

def run_clean_migration():
    print("=== INICIANDO RESET & APLICAÇÃO CANÔNICA FLYWAY (V1 A V5) ===", flush=True)
    env = dotenv_values(os.path.join(BASE_DIR, ".env"))
    
    conn = psycopg2.connect(
        host=env.get('POSTGRES_HOST'),
        port=env.get('POSTGRES_PORT'),
        dbname=env.get('POSTGRES_DB'),
        user=env.get('POSTGRES_USER'),
        password=env.get('POSTGRES_PASSWORD'),
        sslmode=env.get('POSTGRES_SSLMODE', 'prefer'),
        connect_timeout=15
    )
    conn.autocommit = False
    cur = conn.cursor()

    # 1. Reset do Schema
    print("\n[Passo 1/3] Executando script de Reset do Schema (db/scripts/reset_schema_frotas.sql)...", flush=True)
    with open(RESET_SCRIPT, "r", encoding="utf-8") as f:
        reset_sql = f.read()
    cur.execute(reset_sql)
    conn.commit()
    print("[-] Schema limpo e tabelas antigas removidas com sucesso!", flush=True)

    # 2. Criar flyway_schema_history limpa
    print("\n[Passo 2/3] Criando tabela flyway_schema_history oficial...", flush=True)
    create_history_sql = """
    CREATE TABLE IF NOT EXISTS flyway_schema_history (
        installed_rank INT NOT NULL PRIMARY KEY,
        version VARCHAR(50),
        description VARCHAR(200) NOT NULL,
        type VARCHAR(20) NOT NULL,
        script VARCHAR(1000) NOT NULL,
        checksum INT,
        installed_by VARCHAR(100) NOT NULL,
        installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time INT NOT NULL,
        success BOOLEAN NOT NULL
    );
    CREATE INDEX IF NOT EXISTS flyway_schema_history_s_idx ON flyway_schema_history (success);
    """
    cur.execute(create_history_sql)
    conn.commit()

    # 3. Aplicar Migrações V1 a V4 (V5 é contingência opcional via flag --include-v5-contingencia)
    import sys
    include_v5 = "--include-v5-contingencia" in sys.argv
    print("\n[Passo 3/3] Aplicando migrações sequenciais V1 a V4...", flush=True)
    files = sorted([
        f for f in os.listdir(MIGRATIONS_DIR)
        if f.startswith("V") and f.endswith(".sql") and (include_v5 or not f.startswith("V5__"))
    ])
    
    for rank, filename in enumerate(files, start=1):
        filepath = os.path.join(MIGRATIONS_DIR, filename)
        parts = filename.split("__")
        version = parts[0][1:]
        raw_desc = parts[1].replace(".sql", "").replace("_", " ")
        description = raw_desc.title()
        checksum = compute_checksum(filepath)

        print(f"\n[+] Aplicando V{version}: {description} ({os.path.getsize(filepath):,} bytes)...", flush=True)
        with open(filepath, "r", encoding="utf-8") as f:
            sql_content = f.read()

        t0 = time.time()
        try:
            cur.execute(sql_content)
            exec_time_ms = int((time.time() - t0) * 1000)
            
            # Registrar na flyway_schema_history
            cur.execute("""
                INSERT INTO flyway_schema_history 
                (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
                VALUES (%s, %s, %s, 'SQL', %s, %s, 'antigravity', %s, TRUE);
            """, (rank, version, description, filename, checksum, exec_time_ms))
            
            conn.commit()
            print(f"[✓] V{version} aplicada com sucesso em {exec_time_ms} ms!", flush=True)
        except Exception as e:
            conn.rollback()
            print(f"[X] ERRO ao aplicar migração V{version} ({filename}): {e}", flush=True)
            raise e

    # Validação pós-carga
    print("\n=== VALIDAÇÃO DOS DADOS NO POSTGRESQL ===", flush=True)
    cur.execute("SELECT COUNT(*) FROM tb_tecnico;")
    print(f"Total Técnicos cadastrados: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_base_atp;")
    print(f"Total ATPs operacionais: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_centro_custo;")
    print(f"Total Centros de Custo: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_frota_veiculos;")
    print(f"Total Veículos na Frota: {cur.fetchone()[0]}")
    cur.execute("SELECT status_operacional, COUNT(*) FROM tb_frota_veiculos GROUP BY status_operacional ORDER BY count DESC;")
    for st, cnt in cur.fetchall():
        print(f"  - Status '{st}': {cnt} veículos")
    cur.execute("SELECT COUNT(*) FROM tb_frota_sinistros;")
    print(f"Total Sinistros registrados: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_frota_custodias WHERE status = 'ATIVA';")
    print(f"Total Custódias Ativas: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_frota_manutencoes;")
    print(f"Total Manutenções Periódicas: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_frota_multas;")
    print(f"Total Multas registradas: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM tb_valecard_transacoes;")
    print(f"Total Transações ValeCard: {cur.fetchone()[0]}")

    cur.close()
    conn.close()
    print("\n[✓] PROCESSO CONCLUÍDO COM 100% DE SUCESSO!", flush=True)

if __name__ == "__main__":
    run_clean_migration()

