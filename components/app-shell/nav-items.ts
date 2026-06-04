import {
  LayoutDashboard,
  Building2,
  MapPin,
  ClipboardList,
  AlertOctagon,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { href: "/customers",     label: "Customers",    icon: Building2 },
  { href: "/sites",         label: "Sites",        icon: MapPin },
  { href: "/work-records",  label: "Work records", icon: ClipboardList },
  { href: "/deficiencies",  label: "Deficiencies", icon: AlertOctagon },
  { href: "/reports",       label: "Reports",      icon: FileText },
  { href: "/settings",      label: "Settings",     icon: Settings },
];
