// api/share.js
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

export default async function handler(request, response) {
  const { method } = request;

  try {
    // 1. POST: Link oluşturma (1 Ay geçerlilik süresi atar)
    if (method === 'POST') {
      const { projectName, procurementData } = request.body;
      const linkUuid = crypto.randomUUID().split('-')[0]; // a1b2c3d4 gibi kısa bir ID
      
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // Bugünden 1 ay sonrasına ayarla

      await sql`
        INSERT INTO procurement_links (link_uuid, project_name, data, expires_at)
        VALUES (${linkUuid}, ${projectName}, ${JSON.stringify(procurementData)}::jsonb, ${expiresAt.toISOString()});
      `;
      
      return response.status(200).json({ success: true, uuid: linkUuid });
    }

    // 2. GET: İndirme sayfası için veriyi getirme
    if (method === 'GET') {
      const { uuid } = request.query;
      
      const { rows } = await sql`
        SELECT project_name, data FROM procurement_links 
        WHERE link_uuid = ${uuid} AND expires_at > NOW();
      `;

      if (rows.length === 0) {
        return response.status(404).json({ error: 'Bağlantı geçersiz veya süresi dolmuş.' });
      }

      return response.status(200).json({ success: true, data: rows[0] });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: error.message });
  }
}