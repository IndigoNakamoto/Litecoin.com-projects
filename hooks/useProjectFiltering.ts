import { useMemo } from 'react'
import { Project } from '@/types/project'
import { determineProjectType, determineBountyStatus } from '@/utils/statusHelpers'
import { isProject, isOpenBounty, isPastProject, isHidden } from '@/utils/projectFilters'
import { sortProjectsByDisplayOrder } from '@/utils/projectSorting'

interface FilteredProjects {
  openSourceProjects: Project[]
  completedProjects: Project[]
  openBounties: Project[]
}

function filterProjects(
  projects: Project[],
  options: { includeHidden?: boolean } = {},
): FilteredProjects {
  const visibleProjects = options.includeHidden
    ? projects
    : projects.filter((p) => !isHidden(p))

  const transformedProjects = visibleProjects.map((project) => ({
    ...project,
    type: determineProjectType(project.status),
    bountyStatus: determineBountyStatus(project.status),
  }))

  // Priority: Completed > Open Bounties > Open Projects
  const completed = transformedProjects.filter(isPastProject)
  const bounties = transformedProjects.filter(
    (p) => isOpenBounty(p) && !isPastProject(p)
  )
  const openProjects = transformedProjects.filter(
    (p) => isProject(p) && !isPastProject(p) && !isOpenBounty(p)
  )

  // Fallback: if no projects match filters, show all as open-source projects
  const allProjectsEmpty =
    openProjects.length === 0 && bounties.length === 0 && completed.length === 0
  const projectsToShow =
    allProjectsEmpty && visibleProjects.length > 0
      ? transformedProjects
      : openProjects

  return {
    openSourceProjects: sortProjectsByDisplayOrder(projectsToShow),
    completedProjects: completed,
    openBounties: bounties,
  }
}

/**
 * Filter and categorize projects. Computed synchronously so SSR/first paint
 * shows projects even before client hydration.
 */
export function useProjectFiltering(
  projects: Project[],
  options: { includeHidden?: boolean } = {},
): FilteredProjects {
  return useMemo(
    () => filterProjects(projects, options),
    [projects, options.includeHidden],
  )
}
