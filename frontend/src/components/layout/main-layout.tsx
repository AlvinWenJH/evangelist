'use client';

import { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from '@/components/ui/sonner';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  // Generate breadcrumb items based on current path
  const getBreadcrumbItems = () => {
    const segments = pathname.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      // Home page
      return (
        <BreadcrumbItem>
          <BreadcrumbPage>Evangelist</BreadcrumbPage>
        </BreadcrumbItem>
      );
    }

    const items = [
      <BreadcrumbItem key="home">
        <BreadcrumbLink href="/">Evangelist</BreadcrumbLink>
      </BreadcrumbItem>
    ];

    if (segments[0] === 'datasets') {
      items.push(<BreadcrumbSeparator key="sep1" />);
      
      if (segments.length === 1) {
        // Datasets page
        items.push(
          <BreadcrumbItem key="datasets">
            <BreadcrumbPage>Datasets</BreadcrumbPage>
          </BreadcrumbItem>
        );
      } else {
        // Dataset detail page
        items.push(
          <BreadcrumbItem key="datasets-link">
            <BreadcrumbLink href="/datasets">Datasets</BreadcrumbLink>
          </BreadcrumbItem>
        );
        items.push(<BreadcrumbSeparator key="sep2" />);
        items.push(
          <BreadcrumbItem key="dataset-detail">
            <BreadcrumbPage>Detail</BreadcrumbPage>
          </BreadcrumbItem>
        );
      }
    } else if (segments[0] === 'suites') {
      items.push(<BreadcrumbSeparator key="sep1" />);
      
      if (segments.length === 1) {
        // Suites page
        items.push(
          <BreadcrumbItem key="suites">
            <BreadcrumbPage>Suites</BreadcrumbPage>
          </BreadcrumbItem>
        );
      } else {
        // Suite detail or edit page
        items.push(
          <BreadcrumbItem key="suites-link">
            <BreadcrumbLink href="/suites">Suites</BreadcrumbLink>
          </BreadcrumbItem>
        );
        items.push(<BreadcrumbSeparator key="sep2" />);
        
        if (segments.length === 2) {
          // Suite detail page (/suites/[id])
          items.push(
            <BreadcrumbItem key="suite-detail">
              <BreadcrumbPage>Detail</BreadcrumbPage>
            </BreadcrumbItem>
          );
        } else if (segments.length === 3 && segments[2] === 'edit') {
          // Suite edit page (/suites/[id]/edit)
          items.push(
            <BreadcrumbItem key="suite-detail-link">
              <BreadcrumbLink href={`/suites/${segments[1]}`}>Detail</BreadcrumbLink>
            </BreadcrumbItem>
          );
          items.push(<BreadcrumbSeparator key="sep3" />);
          items.push(
            <BreadcrumbItem key="suite-edit">
              <BreadcrumbPage>Edit Configuration</BreadcrumbPage>
            </BreadcrumbItem>
          );
        }
      }
    }

    return items;
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex items-center gap-2">
            <Breadcrumb>
              <BreadcrumbList>
                {getBreadcrumbItems()}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}