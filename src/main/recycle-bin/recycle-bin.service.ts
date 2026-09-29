import { getPrisma } from '../database/client';

export type RecycleBinEntityType = 'patient' | 'appointment' | 'invoice' | 'medicine';

export interface RecycleBinItem {
  id: string;
  entityType: RecycleBinEntityType;
  title: string;
  subtitle: string;
  deletedAt: string;
  createdAt: string;
}

export async function listDeletedItems(): Promise<RecycleBinItem[]> {
  const db = getPrisma();

  const [patients, appointments, invoices, medicines] = await Promise.all([
    db.patient.findMany({
      where: { isDeleted: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mrNumber: true,
        phone: true,
        deletedAt: true,
        createdAt: true,
      },
      orderBy: { deletedAt: 'desc' },
      take: 100,
    }),
    db.appointment.findMany({
      where: { isDeleted: true },
      select: {
        id: true,
        startsAt: true,
        status: true,
        deletedAt: true,
        createdAt: true,
        patient: { select: { firstName: true, lastName: true } },
        provider: { select: { firstName: true, lastName: true } },
      },
      orderBy: { deletedAt: 'desc' },
      take: 100,
    }),
    db.invoice.findMany({
      where: { isDeleted: true },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        deletedAt: true,
        createdAt: true,
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { deletedAt: 'desc' },
      take: 100,
    }),
    db.medicine.findMany({
      where: { isDeleted: true },
      select: {
        id: true,
        name: true,
        unit: true,
        mg: true,
        deletedAt: true,
        createdAt: true,
      },
      orderBy: { deletedAt: 'desc' },
      take: 100,
    }),
  ]);

  const items: RecycleBinItem[] = [];

  for (const p of patients) {
    items.push({
      id: p.id,
      entityType: 'patient',
      title: `${p.firstName} ${p.lastName}`.trim() || 'Unnamed Patient',
      subtitle: [p.mrNumber ? `MR# ${p.mrNumber}` : null, p.phone ? `Phone: ${p.phone}` : null]
        .filter(Boolean)
        .join(' • ') || 'Patient Record',
      deletedAt: p.deletedAt ? p.deletedAt.toISOString() : new Date().toISOString(),
      createdAt: p.createdAt.toISOString(),
    });
  }

  for (const a of appointments) {
    const patName = a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : 'Unknown Patient';
    const docName = a.provider ? `Dr. ${a.provider.firstName} ${a.provider.lastName}`.trim() : 'Doctor';
    const dateStr = a.startsAt ? new Date(a.startsAt).toLocaleString() : '';
    items.push({
      id: a.id,
      entityType: 'appointment',
      title: `Appointment: ${patName}`,
      subtitle: `${docName} • ${dateStr} • Status: ${a.status}`,
      deletedAt: a.deletedAt ? a.deletedAt.toISOString() : new Date().toISOString(),
      createdAt: a.createdAt.toISOString(),
    });
  }

  for (const inv of invoices) {
    const patName = inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}`.trim() : 'Walk-in / Unknown';
    items.push({
      id: inv.id,
      entityType: 'invoice',
      title: `Invoice #${inv.invoiceNumber}`,
      subtitle: `Patient: ${patName} • Total: PKR ${Number(inv.total).toLocaleString()}`,
      deletedAt: inv.deletedAt ? inv.deletedAt.toISOString() : new Date().toISOString(),
      createdAt: inv.createdAt.toISOString(),
    });
  }

  for (const m of medicines) {
    const strength = m.mg ? ` (${m.mg}mg)` : '';
    const unit = m.unit ? ` - ${m.unit}` : '';
    items.push({
      id: m.id,
      entityType: 'medicine',
      title: `${m.name}${strength}`,
      subtitle: `Medicine Catalog${unit}`,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : new Date().toISOString(),
      createdAt: m.createdAt.toISOString(),
    });
  }

  // Sort newest deleted first
  items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  return items;
}

export async function restoreItem(entityType: RecycleBinEntityType, id: string): Promise<{ ok: boolean }> {
  const db = getPrisma();
  const now = new Date();

  switch (entityType) {
    case 'patient':
      await db.patient.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, updatedAt: now },
      });
      break;

    case 'appointment':
      await db.appointment.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, updatedAt: now },
      });
      break;

    case 'invoice':
      await db.invoice.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, updatedAt: now },
      });
      break;

    case 'medicine':
      await db.medicine.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, updatedAt: now },
      });
      break;

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  return { ok: true };
}

export async function purgeItem(entityType: RecycleBinEntityType, id: string): Promise<{ ok: boolean }> {
  const db = getPrisma();

  switch (entityType) {
    case 'patient':
      await db.$transaction(async (tx) => {
        const tokens = await tx.token.findMany({ where: { patientId: id }, select: { id: true } });
        const tokenIds = tokens.map((t) => t.id);
        if (tokenIds.length > 0) {
          await tx.$executeRawUnsafe(
            `DELETE FROM "Prescription" WHERE tokenId IN (${tokenIds.map(() => '?').join(',')})`,
            ...tokenIds,
          );
        }
        await tx.token.deleteMany({ where: { patientId: id } });
        await tx.appointment.deleteMany({ where: { patientId: id } });

        const invoices = await tx.invoice.findMany({ where: { patientId: id }, select: { id: true } });
        const invoiceIds = invoices.map((inv) => inv.id);
        if (invoiceIds.length > 0) {
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
          await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
          await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
        }

        await tx.labOrder.deleteMany({ where: { patientId: id } });
        await tx.patient.delete({ where: { id } });
      });
      break;

    case 'appointment':
      await db.appointment.delete({ where: { id } });
      break;

    case 'invoice':
      await db.$transaction(async (tx) => {
        await tx.payment.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoice.delete({ where: { id } });
      });
      break;

    case 'medicine':
      await db.$transaction(async (tx) => {
        await tx.medicineBatch.deleteMany({ where: { medicineId: id } });
        await tx.medicine.delete({ where: { id } });
      });
      break;

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  return { ok: true };
}

/**
 * Automatically permanently delete items that have been in the recycle bin for longer than retentionDays (default: 7 days)
 */
export async function autoPurgeOldDeletedItems(retentionDays = 7): Promise<{ purged: number }> {
  const db = getPrisma();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let totalPurged = 0;

  try {
    // 1. Purge expired appointments
    const expiredAppointments = await db.appointment.findMany({
      where: { isDeleted: true, deletedAt: { lte: cutoff } },
      select: { id: true },
    });
    for (const item of expiredAppointments) {
      try {
        await purgeItem('appointment', item.id);
        totalPurged++;
      } catch (e) {
        console.warn(`[RecycleBin] Auto-purge appointment ${item.id} error:`, e);
      }
    }

    // 2. Purge expired invoices
    const expiredInvoices = await db.invoice.findMany({
      where: { isDeleted: true, deletedAt: { lte: cutoff } },
      select: { id: true },
    });
    for (const item of expiredInvoices) {
      try {
        await purgeItem('invoice', item.id);
        totalPurged++;
      } catch (e) {
        console.warn(`[RecycleBin] Auto-purge invoice ${item.id} error:`, e);
      }
    }

    // 3. Purge expired medicines
    const expiredMedicines = await db.medicine.findMany({
      where: { isDeleted: true, deletedAt: { lte: cutoff } },
      select: { id: true },
    });
    for (const item of expiredMedicines) {
      try {
        await purgeItem('medicine', item.id);
        totalPurged++;
      } catch (e) {
        console.warn(`[RecycleBin] Auto-purge medicine ${item.id} error:`, e);
      }
    }

    // 4. Purge expired patients (after related appointments/invoices are purged)
    const expiredPatients = await db.patient.findMany({
      where: { isDeleted: true, deletedAt: { lte: cutoff } },
      select: { id: true },
    });
    for (const item of expiredPatients) {
      try {
        await purgeItem('patient', item.id);
        totalPurged++;
      } catch (e) {
        console.warn(`[RecycleBin] Auto-purge patient ${item.id} error:`, e);
      }
    }

    if (totalPurged > 0) {
      console.log(`[RecycleBin] Auto-purged ${totalPurged} deleted items older than ${retentionDays} days.`);
    }
  } catch (err) {
    console.error('[RecycleBin] Error during auto-purge:', err);
  }

  return { purged: totalPurged };
}

let autoPurgeTimer: NodeJS.Timeout | null = null;

export function startRecycleBinAutoPurgeScheduler(retentionDays = 7): void {
  if (autoPurgeTimer) clearInterval(autoPurgeTimer);

  // Initial check after 20 seconds of app start
  setTimeout(() => {
    void autoPurgeOldDeletedItems(retentionDays);
  }, 20_000);

  // Periodic check every 6 hours
  autoPurgeTimer = setInterval(() => {
    void autoPurgeOldDeletedItems(retentionDays);
  }, 6 * 60 * 60 * 1000);
}

export function stopRecycleBinAutoPurgeScheduler(): void {
  if (autoPurgeTimer) {
    clearInterval(autoPurgeTimer);
    autoPurgeTimer = null;
  }
}
