const db = require('../config/database');

class Subscriber {
  // Bulk insert multiple subscribers at once
 
  // Bulk insert multiple subscribers at once
static async bulkCreate(subscribersData) {
  if (subscribersData.length === 0) return { insertedIds: [], duplicates: 0 };

  const values = [];
  const placeholders = [];

  subscribersData.forEach(sub => {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'); // Added one more ?
    values.push(
      sub.email,
      sub.name,
      sub.date_added,
      sub.stop_time,
      sub.stop_status || 0,
      sub.misc,
      sub.ad_tracking,
      sub.ip_address,
      sub.web_form_url,
      sub.country,
      sub.region,
      sub.city,
      sub.postal_code,
      sub.latitude,
      sub.longitude,
      sub.dma_code,
      sub.area_code,
      sub.tags,
      sub.phone // NEW
    );
  });

  const sql = `
    INSERT INTO subscribers (
      email, name, date_added, stop_time, stop_status, misc, 
      ad_tracking, ip_address, web_form_url, country, region, 
      city, postal_code, latitude, longitude, dma_code, area_code, tags, phone
    ) VALUES ${placeholders.join(', ')}
    ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
  `;

  try {
    const [result] = await db.execute(sql, values);
    return { 
      insertedIds: result.insertId,
      affectedRows: result.affectedRows,
      duplicates: subscribersData.length - result.affectedRows
    };
  } catch (error) {
    throw error;
  }
}

  // Bulk add subscribers to a list (FIXED VERSION)
  static async bulkAddToList(subscriberEmails, listId) {
    if (subscriberEmails.length === 0) return;

    const BATCH_SIZE = 1000; // Process 1000 emails at a time to avoid placeholder limit
    
    console.log(`🔗 Adding ${subscriberEmails.length} subscribers to list in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < subscriberEmails.length; i += BATCH_SIZE) {
      const emailBatch = subscriberEmails.slice(i, i + BATCH_SIZE);
      
      // Get subscriber IDs from emails
      const placeholders = emailBatch.map(() => '?').join(',');
      const [subscribers] = await db.execute(
        `SELECT id FROM subscribers WHERE email IN (${placeholders})`,
        emailBatch
      );

      if (subscribers.length === 0) continue;

      // Bulk insert into list_subscribers
      const values = [];
      const valuePlaceholders = [];

      subscribers.forEach(sub => {
        valuePlaceholders.push('(?, ?)');
        values.push(sub.id, listId);
      });

      const sql = `
        INSERT IGNORE INTO list_subscribers (subscriber_id, list_id) 
        VALUES ${valuePlaceholders.join(', ')}
      `;

      await db.execute(sql, values);
      
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(subscriberEmails.length / BATCH_SIZE);
      console.log(`✅ List association batch ${batchNum}/${totalBatches} complete (${subscribers.length} subscribers)`);
    }
    
    console.log(`🎉 All ${subscriberEmails.length} subscribers added to list ${listId}`);
  }

  static async create(subscriberData) {
    const {
      email,
      name,
      date_added,
      stop_time,
      stop_status,
      misc,
      ad_tracking,
      ip_address,
      web_form_url,
      country,
      region,
      city,
      postal_code,
      latitude,
      longitude,
      dma_code,
      area_code,
      tags,
      phone
    } = subscriberData;
  
    try {
      const [result] = await db.execute(
        `INSERT INTO subscribers (
          email, name, date_added, stop_time, stop_status, misc, 
          ad_tracking, ip_address, web_form_url, country, region, 
          city, postal_code, latitude, longitude, dma_code, area_code, tags, phone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [
          email || null,
          name || null,
          date_added || null,
          stop_time || null,
          stop_status || 0,
          misc || null,
          ad_tracking || null,
          ip_address || null,
          web_form_url || null,
          country || null,
          region || null,
          city || null,
          postal_code || null,
          latitude || null,
          longitude || null,
          dma_code || null,
          area_code || null,
          tags || null,
          phone || null
        ]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  static async addToList(subscriberId, listId) {
    try {
      await db.execute(
        'INSERT IGNORE INTO list_subscribers (subscriber_id, list_id) VALUES (?, ?)',
        [subscriberId, listId]
      );
    } catch (error) {
      throw error;
    }
  }

  static async getByListId(listId) {
    const [rows] = await db.execute(
      `SELECT s.* FROM subscribers s
       JOIN list_subscribers ls ON s.id = ls.subscriber_id
       WHERE ls.list_id = ?
       ORDER BY s.date_added DESC`,
      [listId]
    );
    return rows;
  }

  static async getAll() {
    const [rows] = await db.execute('SELECT * FROM subscribers ORDER BY date_added DESC');
    return rows;
  }

  static async deleteById(id) {
    await db.execute('DELETE FROM subscribers WHERE id = ?', [id]);
  }
}

module.exports = Subscriber;