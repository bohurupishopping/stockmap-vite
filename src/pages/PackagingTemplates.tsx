import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import PackagingTemplateModal from '@/components/packaging/PackagingTemplateModal';
import PackagingTemplatesTable from '@/components/packaging/PackagingTemplatesTable';

type PackagingTemplate = Database['public']['Tables']['packaging_templates']['Row'];

const PackagingTemplates = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PackagingTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch templates grouped by template_name
  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ['packaging-templates', searchTerm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_templates')
        .select('*')
        .order('template_name', { ascending: true })
        .order('order_in_hierarchy', { ascending: true });
      
      if (error) throw error;

      // Filter by search term if provided
      let filteredData = data as PackagingTemplate[];
      if (searchTerm) {
        filteredData = filteredData.filter(template => 
          template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.unit_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Group templates by template_name
      const grouped = filteredData.reduce((acc, template) => {
        if (!acc[template.template_name]) {
          acc[template.template_name] = [];
        }
        acc[template.template_name].push(template);
        return acc;
      }, {} as Record<string, PackagingTemplate[]>);

      return grouped;
    },
  });

  const handleAddNew = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleEdit = (template: PackagingTemplate) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  const handleSuccess = () => {
    refetch();
    handleCloseModal();
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Packaging Templates
          </h1>
          <p className="text-gray-600">
            Manage reusable packaging unit templates for products
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-40 rounded-full border-0 focus-visible:ring-1"
              />
            </div>
          </div>

          <Button 
            onClick={handleAddNew} 
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg border">
        <PackagingTemplatesTable
          templates={templates || {}}
          isLoading={isLoading}
          onEdit={handleEdit}
          onRefresh={refetch}
        />
      </div>

      {/* Modal */}
      <PackagingTemplateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        editingTemplate={editingTemplate}
      />
    </div>
  );
};

export default PackagingTemplates; 