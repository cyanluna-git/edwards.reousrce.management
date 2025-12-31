import React from 'react';
import { ProjectHierarchyEditor } from '@/components/projects/ProjectHierarchyEditor';

const ProjectsPage: React.FC = () => {
  return (
    <div className="container mx-auto py-6">
      <ProjectHierarchyEditor />
    </div>
  );
};

export default ProjectsPage;
