
import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  const { method } = request;

  try {
    // GET: List Projects by Account ID
    if (method === 'GET') {
      const { accountId } = request.query;
      
      if (!accountId) {
        return response.status(400).json({ error: 'Account ID is required' });
      }

      const { rows } = await sql`
        SELECT id, project_uuid, name, last_modified, data 
        FROM projects 
        WHERE account_id = ${accountId} 
        ORDER BY last_modified DESC;
      `;

      // Frontend expects specific structure, map if necessary, but rows should map directly if column names match types
      // Converting project_uuid to id for frontend compatibility
      const projects = rows.map(row => ({
        id: row.project_uuid,
        name: row.name,
        lastModified: parseInt(row.last_modified),
        data: row.data
      }));

      return response.status(200).json({ projects });
    }

    // POST: Save (Insert or Update) Project
    if (method === 'POST') {
      const { accountId, project } = request.body;

      if (!accountId || !project) {
        return response.status(400).json({ error: 'Missing data' });
      }

      // Check limit (Max 10 projects per account)
      // Only check limit if it's a NEW project (based on ID check)
      // However, simplified logic: Count all. If >= 10 and we are inserting a new ID, block.
      
      const countResult = await sql`SELECT COUNT(*) FROM projects WHERE account_id = ${accountId}`;
      const count = parseInt(countResult.rows[0].count);

      // Check if project exists to determine if it's an update
      const existing = await sql`SELECT project_uuid FROM projects WHERE project_uuid = ${project.id} AND account_id = ${accountId}`;
      const isUpdate = existing.rows.length > 0;

      if (!isUpdate && count >= 10) {
        return response.status(403).json({ success: false, message: 'Maksimum 10 proje limitine ulaştınız. Yeni proje kaydetmek için eski bir projeyi siliniz.' });
      }

      const dataJson = JSON.stringify(project.data);
      const timestamp = Date.now();

      if (isUpdate) {
        // Update existing
        await sql`
          UPDATE projects 
          SET name = ${project.name}, data = ${dataJson}::jsonb, last_modified = ${timestamp}
          WHERE project_uuid = ${project.id} AND account_id = ${accountId};
        `;
      } else {
        // Insert new
        // DEĞİŞİKLİK: ${dataJson} yerine ${dataJson}::jsonb yazıldı
        await sql`
          INSERT INTO projects (project_uuid, account_id, name, data, last_modified)
          VALUES (${project.id}, ${accountId}, ${project.name}, ${dataJson}::jsonb, ${timestamp});
        `;
      }

      return response.status(200).json({ success: true, message: 'Proje başarıyla kaydedildi.' });
    }

    // DELETE: Delete Project
    if (method === 'DELETE') {
      const { accountId, projectId } = request.query; // or body

      if (!accountId || !projectId) {
        return response.status(400).json({ error: 'Missing parameters' });
      }

      await sql`
        DELETE FROM projects 
        WHERE project_uuid = ${projectId} AND account_id = ${accountId};
      `;

      return response.status(200).json({ success: true, message: 'Proje silindi.' });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Database Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
