"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowRightLeft,
  ShoppingCart,
  Users,
  Eye,
  RotateCcw,
  Settings,
  FileText,
  BarChart3,
  Bell,
  UserCog,
  LogOut,
  ChevronUp,
  User,
  Stethoscope,
  Activity,
  Tags,
} from "lucide-react"

const navigationItems = [
  {
    title: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-blue-600" }],
  },
  {
    title: "Product Management",
    items: [
      { title: "Product Management", url: "/products", icon: Package, color: "text-emerald-600" },
      { title: "Product Categories", url: "/product-categories", icon: Tags, color: "text-emerald-600" },
    ],
  },
 
  {
    title: "Management",
    items: [{ title: "MR Management", url: "/mr-management", icon: UserCog, color: "text-teal-600" }],
  },
  {
    title: "Reports & Analytics",
    items: [
      { title: "Inventory Reports", url: "/inventory-reports", icon: FileText, color: "text-blue-600" },
      { title: "Sales Reports", url: "/sales-reports", icon: BarChart3, color: "text-green-600" },
    ],
  },
  {
    title: "System",
    items: [
      { title: "Alerts & Notifications", url: "/alerts", icon: Bell, color: "text-red-600" },
      { title: "User Management", url: "/user-management", icon: UserCog, color: "text-slate-600" },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [alertsCount, setAlertsCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser()
        
        if (authError) throw authError
        if (!user) return
        
        setUser(user)

        // Get user details from users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single()

        if (userError) {
          console.error('Error fetching user data:', userError)
          return
        }

        setProfile(userData)

        // Check if alerts table exists before querying
        const { data: tableExists } = await supabase
          .rpc('table_exists', { table_name: 'alerts' })

        if (tableExists) {
          // Get unread alerts count
          const { count, error: alertsError } = await supabase
            .from("alerts")
            .select("*", { count: "exact", head: true })
            .eq("is_read", false)
            .or(`user_id.eq.${user.id},user_id.is.null`)

          if (alertsError) {
            console.error('Error fetching alerts:', alertsError)
          } else {
            setAlertsCount(count || 0)
          }
        }
      } catch (error) {
        console.error('Error in getUser:', error)
      }
    }

    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-gradient-to-r from-purple-500 to-pink-500"
      case "mr":
        return "bg-gradient-to-r from-blue-500 to-cyan-500"
      case "warehouse":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500"
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "mr":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "warehouse":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Sidebar {...props} className="border-r border-gray-200/60 bg-gradient-to-b from-white to-gray-50/30">
      <SidebarHeader className="border-b border-gray-200/60 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg">MedStock Pro</span>
            <span className="text-xs text-white/80">Medical Inventory System</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {navigationItems.map((section) => (
          <SidebarGroup key={section.title} className="mb-4">
            <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className="group relative rounded-xl transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:shadow-md data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-500 data-[active=true]:to-purple-500 data-[active=true]:text-white data-[active=true]:shadow-lg"
                    >
                      <a href={item.url} className="flex items-center gap-3 px-3 py-2.5">
                        <item.icon
                          className={`h-5 w-5 ${pathname === item.url ? "text-white" : item.color} transition-colors`}
                        />
                        <span className="font-medium">{item.title}</span>
                        {item.title === "Alerts & Notifications" && alertsCount > 0 && (
                          <Badge className="ml-auto h-5 w-5 rounded-full bg-red-500 p-0 text-xs text-white flex items-center justify-center">
                            {alertsCount > 99 ? "99+" : alertsCount}
                          </Badge>
                        )}
                        {pathname === item.url && (
                          <div className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-white" />
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200/60 bg-gradient-to-r from-gray-50 to-white p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="group rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200/60 p-3">
                  <div className="flex items-center gap-3 w-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback
                        className={`text-white text-sm font-semibold ${getRoleColor(profile?.role || "mr")}`}
                      >
                        {profile?.full_name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 text-left">
                      <span className="font-medium text-sm truncate">
                        {profile?.full_name || user?.email || "User"}
                      </span>
                      <Badge className={`text-xs w-fit ${getRoleBadgeColor(profile?.role || "mr")}`}>
                        {profile?.role?.toUpperCase() || "USER"}
                      </Badge>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width] rounded-xl shadow-xl border-gray-200/60"
              >
                <DropdownMenuItem className="rounded-lg">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg">
                  <Activity className="mr-2 h-4 w-4" />
                  <span>Activity Log</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
