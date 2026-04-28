/**
 * Agency / white-label tenants.
 *
 * Each AgencyTenant owns one or more MerchantGroups. Branding overrides apply
 * to embedded admin shells, customer landing pages, and the public order
 * tracking + returns pages. Match priority:
 *   1. Custom domain (host header) → tenant
 *   2. Shop → MerchantGroup → AgencyTenant
 */
import prisma from '../db.server';

export interface AgencyBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  supportUrl: string | null;
  hidePoweredBy: boolean;
}

export const DEFAULT_BRANDING: AgencyBranding = {
  name: 'Cashflow COD',
  logoUrl: null,
  primaryColor: '#10b981',
  accentColor: '#0f172a',
  supportUrl: null,
  hidePoweredBy: false,
};

export async function listTenants() {
  return prisma.agencyTenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { groups: { include: { shops: { select: { id: true, domain: true } } } } },
  });
}

export async function createTenant(input: {
  slug: string;
  name: string;
  contactEmail?: string;
  customDomain?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  supportUrl?: string;
  hidePoweredBy?: boolean;
}) {
  return prisma.agencyTenant.create({ data: input });
}

export async function updateTenant(id: string, input: Partial<Parameters<typeof createTenant>[0]>) {
  return prisma.agencyTenant.update({ where: { id }, data: input });
}

export async function deleteTenant(id: string) {
  await prisma.agencyTenant.delete({ where: { id } });
}

export async function attachGroupToTenant(groupId: string, tenantId: string | null) {
  return prisma.merchantGroup.update({
    where: { id: groupId },
    data: { agencyTenantId: tenantId },
  });
}

export async function brandingForShop(shopId: string): Promise<AgencyBranding> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      merchantGroup: {
        select: {
          agencyTenant: true,
        },
      },
    },
  });
  const tenant = shop?.merchantGroup?.agencyTenant;
  if (!tenant) return DEFAULT_BRANDING;
  return {
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    accentColor: tenant.accentColor ?? DEFAULT_BRANDING.accentColor,
    supportUrl: tenant.supportUrl,
    hidePoweredBy: tenant.hidePoweredBy,
  };
}

export async function brandingForHost(host: string): Promise<AgencyBranding> {
  const tenant = await prisma.agencyTenant.findUnique({ where: { customDomain: host } });
  if (!tenant) return DEFAULT_BRANDING;
  return {
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    accentColor: tenant.accentColor ?? DEFAULT_BRANDING.accentColor,
    supportUrl: tenant.supportUrl,
    hidePoweredBy: tenant.hidePoweredBy,
  };
}
