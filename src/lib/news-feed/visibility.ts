type NewsVisibilityPost = {
  visibility: string;
  departmentIds: unknown;
  teamIds: unknown;
  userIds: unknown;
};

type NewsVisibilityUser = {
  id: string;
  departmentId?: string | null;
  teamId?: string | null;
};

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function canSeeNewsPost(post: NewsVisibilityPost, user: NewsVisibilityUser) {
  if (post.visibility === "all") return true;
  const departmentIds = jsonArray(post.departmentIds).map(String);
  const teamIds = jsonArray(post.teamIds).map(String);
  const userIds = jsonArray(post.userIds).map(String);
  return (
    userIds.includes(user.id) ||
    Boolean(user.departmentId && departmentIds.includes(user.departmentId)) ||
    Boolean(user.teamId && teamIds.includes(user.teamId))
  );
}
