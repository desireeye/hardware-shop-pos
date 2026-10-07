export const ADMIN_NAV_ITEMS = [
  'Dashboard',
  'New Sale',
  'Products',
  'Customers',
  'Orders',
  'Returns',
  'Suppliers',
  'Reports',
  'Users',
  'Settings',
];

export const STAFF_NAV_ITEMS = [
  'Dashboard',
  'New Sale',
  'Products',
  'Customers',
  'Orders',
  'Returns',
];

export const canAccessRoute = (role: string | undefined, route: string) => {
  if (!role) {
    return false;
  }

  if (role === 'ADMIN') {
    return true;
  }

  return STAFF_NAV_ITEMS.includes(route);
};
