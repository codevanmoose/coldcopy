/**
 * White-Label Sidebar Component
 * 
 * Customizable sidebar navigation for white-label domains
 */

'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  BarChart3,
  Users,
  Mail,
  Settings,
  PlusCircle,
  Inbox,
  Target,
  TrendingUp,
  CreditCard,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface WhiteLabelSidebarProps {
  branding: {
    companyName: string;
    logoUrl?: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  workspaceId?: string | null;
}

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/white-label/dashboard',
    icon: BarChart3,
  },
  {
    name: 'Campaigns',
    href: '/white-label/campaigns',
    icon: Mail,
  },
  {
    name: 'Analytics',
    href: '/white-label/analytics',
    icon: TrendingUp,
  },
  {
    name: 'Leads',
    href: '/white-label/leads',
    icon: Users,
  },
  {
    name: 'Inbox',
    href: '/white-label/inbox',
    icon: Inbox,
  },
];

const secondaryItems = [
  {
    name: 'Settings',
    href: '/white-label/settings',
    icon: Settings,
  },
  {
    name: 'Billing',
    href: '/white-label/billing',
    icon: CreditCard,
  },
  {
    name: 'Help',
    href: '/white-label/help',
    icon: HelpCircle,
  },
];

export function WhiteLabelSidebar({ branding, workspaceId }: WhiteLabelSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={`${branding.companyName} Logo`}
                className="h-8 w-auto"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {branding.companyName.charAt(0)}
              </div>
            )}
            <span className="font-bold text-gray-900 dark:text-white truncate">
              {branding.companyName}
            </span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* New Campaign Button */}
      <div className="p-4">
        <Button
          className="w-full justify-start"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          {!collapsed && 'New Campaign'}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {/* Primary Navigation */}
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
                  collapsed ? 'justify-center' : 'justify-start'
                )}
                style={isActive ? { backgroundColor: branding.primaryColor } : undefined}
              >
                <Icon className={cn('h-5 w-5', !collapsed && 'mr-3')} />
                {!collapsed && item.name}
              </a>
            );
          })}
        </div>

        {/* Divider */}
        {!collapsed && (
          <div className="pt-4">
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Account
              </p>
            </div>
          </div>
        )}

        {/* Secondary Navigation */}
        <div className="space-y-1 pt-2">
          {secondaryItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
                  collapsed ? 'justify-center' : 'justify-start'
                )}
                style={isActive ? { backgroundColor: branding.primaryColor } : undefined}
              >
                <Icon className={cn('h-5 w-5', !collapsed && 'mr-3')} />
                {!collapsed && item.name}
              </a>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>Powered by {branding.companyName}</p>
            <p className="mt-1">© 2024 All rights reserved</p>
          </div>
        </div>
      )}
    </div>
  );
}