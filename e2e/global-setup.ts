import { API_URL } from './playwright.config';

async function globalSetup() {
  const res = await fetch(`${API_URL}/api/health`);
  const health = await res.json();
  const db = health?.data?.services?.database;

  if (db?.name && !String(db.name).endsWith('_test')) {
    throw new Error(
      `The API on ${API_URL} is connected to "${db.name}", not the e2e database. ` +
        'Something else is holding this port — stop it before running the suite.'
    );
  }
}

export default globalSetup;
