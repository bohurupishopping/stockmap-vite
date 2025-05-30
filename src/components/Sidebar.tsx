
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  LogOut, 
  Home, 
  Package, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Beaker,
  TrendingUp,
  PackageOpen,
  Truck,
  FileEdit,
  BarChart3,
  ChevronUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isCollapsed, onToggle }: SidebarProps) => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
    window.location.href = '/auth';
  };

  // Group menu items by category
  const navigationGroups = [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          icon: Home,
          href: "/admin/dashboard",
          color: "text-blue-600"
        },
      ]
    },
    {
      title: "Product Management",
      items: [
        {
          title: "Products",
          icon: Package,
          href: "/admin/products",
          color: "text-emerald-600"
        },
        {
          title: "Product Categories",
          icon: Package,
          href: "/admin/product-categories",
          color: "text-emerald-600"
        },
        {
          title: "Product Formulations",
          icon: Beaker,
          href: "/admin/product-formulations",
          color: "text-emerald-600"
        },
      ]
    },
    {
      title: "Inventory Management",
      items: [
        {
          title: "Stock Movements",
          icon: TrendingUp,
          href: "/admin/stock-movements",
          color: "text-purple-600"
        },
        {
          title: "Stock Purchase",
          icon: PackageOpen,
          href: "/admin/stock/purchase",
          color: "text-purple-600"
        },
        {
          title: "Stock Sales",
          icon: Truck,
          href: "/admin/stock/dispatches",
          color: "text-purple-600"
        },
        {
          title: "Stock Adjustments",
          icon: FileEdit,
          href: "/admin/stock/adjustments",
          color: "text-purple-600"
        },
        {
          title: "Report",
          icon: BarChart3,
          href: "/admin/report",
          color: "text-purple-600"
        },
      ]
    },
    {
      title: "Administration",
      items: [
        {
          title: "Suppliers",
          icon: Building2,
          href: "/admin/suppliers",
          color: "text-orange-600"
        },
        {
          title: "Users",
          icon: Users,
          href: "/admin/users",
          color: "text-orange-600"
        },
        
      ]
    },
  ];

  const getRoleBadgeColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "staff":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className={cn(
      "bg-gradient-to-br from-white to-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 shadow-sm h-full",
      isCollapsed ? "w-20" : "w-72"
    )}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between p-4">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm mr-3">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold">StockMap</h1>
                <span className="text-xs text-white/80">Inventory System</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm mx-auto">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="ml-auto rounded-full hover:bg-white/20 p-2 h-8 w-8 text-white"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {navigationGroups.map((group) => (
          <div key={group.title} className="mb-6 last:mb-0">
            {!isCollapsed && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
                        isActive
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                          : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center",
                        isActive ? "text-white" : item.color,
                        isCollapsed ? "mx-auto" : "mr-3"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {!isCollapsed && (
                        <span className={cn(
                          "transition-all duration-200",
                          isActive && "font-semibold"
                        )}>{item.title}</span>
                      )}
                      {isActive && (
                        <div className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-white" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 bg-white/70 backdrop-blur-sm">
        {!isCollapsed ? (
          <div className="relative">
            <div 
              className="mb-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200/60 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold shadow-sm">
                  {profile?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
                </div>
                <div className="flex flex-col flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                  <div className="mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize border ${getRoleBadgeColor(profile?.role)}`}>
                      {profile?.role || "User"}
                    </span>
                  </div>
                </div>
                <ChevronUp className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isProfileOpen ? '' : 'transform rotate-180'}`} />
              </div>
            </div>
            
            {isProfileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <div 
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold shadow-sm">
                {profile?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
              </div>
            </div>
            
            {isProfileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10 w-40">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
