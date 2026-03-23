import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

type CreateSqliteDatabaseOptions = {
  filename: string;
};

export function createSqliteDatabase(
  options: CreateSqliteDatabaseOptions,
): SqliteDatabase {
  const filename = normalizeSqliteFilename(options.filename);
  return new Database(filename);
}

export function closeSqliteDatabase(database: SqliteDatabase): void {
  database.close();
}

function normalizeSqliteFilename(filename: string): string {
  if (filename.startsWith("file:")) {
    return filename.slice("file:".length);
  }

  if (filename.startsWith("sqlite:")) {
    return filename.slice("sqlite:".length);
  }

  return filename;
}
