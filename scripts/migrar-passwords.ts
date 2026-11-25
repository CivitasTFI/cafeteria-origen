
import { pool } from '../src/db';
import { hashPassword } from '../src/services/usuarios.service';

const FORMATO_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function migrarPasswords(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Bloqueamos las filas para evitar cambios concurrentes.
        const { rows } = await client.query<{
            id: number;
            username: string;
            password: string;
        }>(
            `SELECT id, username, password
                FROM usuarios
                ORDER BY id
            FOR UPDATE`
        );

        let migradas = 0;
        let yaHasheadas = 0;
        let omitidas = 0;

        for (const usuario of rows) {
            if (FORMATO_BCRYPT.test(usuario.password)) {
                yaHasheadas++;
                continue;
            }

        if (!usuario.password || usuario.password.trim() === '') {
            console.warn(`Usuario ${usuario.id}: contraseña vacía. Se omite.`);
            omitidas++;
            continue;
        }

        const passwordHash = await hashPassword(usuario.password);

        const resultado = await client.query(
            `UPDATE usuarios
                SET password = $1
            WHERE id = $2 AND password = $3`,
            [passwordHash, usuario.id, usuario.password]
        );

        if (resultado.rowCount !== 1) {
            throw new Error(
                `No se pudo actualizar el usuario ${usuario.id}.`
            );
        }

        migradas++;
    }

    // Por defecto solamente informa qué haría.
    if (process.env.CONFIRMAR_MIGRACION !== 'SI') {
        await client.query('ROLLBACK');

        console.log('Modo de prueba: no se modificó la base.');
        console.log(`Contraseñas que se migrarían: ${migradas}`);
        console.log(`Ya hasheadas: ${yaHasheadas}`);
        console.log(`Omitidas: ${omitidas}`);
        return;
    }

    await client.query('COMMIT');

    console.log('Migración completada.');
    console.log(`Contraseñas migradas: ${migradas}`);
    console.log(`Ya hasheadas: ${yaHasheadas}`);
    console.log(`Omitidas: ${omitidas}`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrarPasswords().catch((error) => {
    console.error('Error durante la migración:', error.message);
    process.exitCode = 1;
});
