import { Helmet } from 'react-helmet-async';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const SITE_URL = 'https://truejobs.co.in';

interface GovtPaginationProps {
  /** Base path without query params, e.g. "/ssc-jobs" */
  basePath: string;
  currentPage: number;
  totalPages: number;
}

function buildPageUrl(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

function getWindowedPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) pages.push('ellipsis');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('ellipsis');

  pages.push(total);
  return pages;
}

export function GovtPagination({ basePath, currentPage, totalPages }: GovtPaginationProps) {
  if (totalPages <= 1) return null;

  const fullBasePath = basePath.startsWith('http') ? basePath : `${SITE_URL}${basePath}`;
  const canonicalUrl = currentPage <= 1 ? fullBasePath : `${fullBasePath}?page=${currentPage}`;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const windowedPages = getWindowedPages(currentPage, totalPages);

  return (
    <>
      <Helmet>
        <link rel="canonical" href={canonicalUrl} />
        {hasPrev && (
          <link
            rel="prev"
            href={currentPage === 2 ? fullBasePath : `${fullBasePath}?page=${currentPage - 1}`}
          />
        )}
        {hasNext && (
          <link rel="next" href={`${fullBasePath}?page=${currentPage + 1}`} />
        )}
      </Helmet>

      <Pagination className="mt-8">
        <PaginationContent>
          {hasPrev && (
            <PaginationItem>
              <PaginationPrevious href={buildPageUrl(basePath, currentPage - 1)} />
            </PaginationItem>
          )}

          {windowedPages.map((page, idx) =>
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  href={buildPageUrl(basePath, page)}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          {hasNext && (
            <PaginationItem>
              <PaginationNext href={buildPageUrl(basePath, currentPage + 1)} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </>
  );
}
