
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./components/auth/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import ProductCategories from "./pages/ProductCategories";
import ProductFormulations from "./pages/ProductFormulations";
import Products from "./pages/Products";
import ProductForm from "./components/products/ProductForm";
import ProductPackaging from "./components/products/ProductPackaging";
import ProductBatches from "./components/products/ProductBatches";
import StockMovements from "./pages/StockMovements";
import Purchase from "./pages/Purchase";
import NewPurchase from "./components/purchase/NewPurchase";
import ViewPurchase from "./components/purchase/ViewPurchase";
import EditPurchase from "./components/purchase/EditPurchase";
import StockDispatches from "./pages/Sale";
import NewMRDispatch from "./components/sale/NewMRDispatch";
import NewDirectSale from "./components/sale/NewDirectSale";
import StockAdjustments from "./pages/StockAdjustments";
import NewReturn from "./components/stock-adjustment/NewReturn";
import NewReplacement from "./components/stock-adjustment/NewReplacement";
import NewDamageLoss from "./components/stock-adjustment/NewDamageLoss";
import StockStatus from "./pages/Report";
import Suppliers from "./pages/Suppliers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/product-categories" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ProductCategories />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/product-formulations" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ProductFormulations />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/products" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Products />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/products/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ProductForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/products/:id/edit" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ProductForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/products/:productId/packaging" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ProductPackaging />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/products/:productId/batches" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ProductBatches />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock-movements" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <StockMovements />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/purchase" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Purchase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/purchase/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewPurchase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/purchase/:id/view" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ViewPurchase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/purchase/:id/edit" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <EditPurchase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/sa" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <StockDispatches />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/dispatches/mr/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewMRDispatch />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/dispatches/sales/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewDirectSale />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/adjustments" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <StockAdjustments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/adjustments/returns/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewReturn />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/adjustments/replacements/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewReplacement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/stock/adjustments/damage-loss/new" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <NewDamageLoss />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/report" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <StockStatus />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/suppliers" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Suppliers />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
