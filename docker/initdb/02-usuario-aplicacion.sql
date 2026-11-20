-- Bootstrap de origen_app después de crear el esquema en un volumen nuevo.
-- psql toma DB_PASSWORD del entorno y la cita como literal SQL.
\set ON_ERROR_STOP on
\set ECHO none
\getenv db_password DB_PASSWORD

BEGIN;

SET LOCAL password_encryption = 'scram-sha-256';
-- Mantener la sentencia con la credencial fuera de los logs de SQL y de errores.
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'origen_app') THEN
        CREATE ROLE origen_app;
    END IF;
END
$$;

ALTER ROLE origen_app
    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    PASSWORD :'db_password';
\unset db_password

REVOKE CONNECT, TEMPORARY ON DATABASE origen FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE origen TO origen_app;
GRANT USAGE ON SCHEMA public TO origen_app;

GRANT SELECT, INSERT ON TABLE
    public.usuarios, public.productos, public.pedidos, public.pedido_items, public.comentarios
    TO origen_app;
GRANT UPDATE ON TABLE public.usuarios, public.productos, public.pedidos TO origen_app;
-- Incluye la limpieza de registros de prueba. Los items se borran en cascada.
GRANT DELETE ON TABLE public.usuarios, public.pedidos, public.comentarios TO origen_app;
GRANT USAGE ON SEQUENCE
    public.usuarios_id_seq, public.productos_id_seq, public.pedidos_id_seq,
    public.pedido_items_id_seq, public.comentarios_id_seq
    TO origen_app;

COMMIT;
