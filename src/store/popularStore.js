import { create } from 'zustand';
import * as popularApi from '../api/popular';

// Stale-while-revalidate: render cached data instantly on tab return,
// then kick off a background refresh so newly-submitted results show up fast.
const usePopularStore = create((set, get) => ({
  dashboard: null,
  trends: null,
  leaderboards: null,
  loading: false,
  refreshing: false,
  fetchedAt: 0,
  error: null,

  clear: () => set({ dashboard: null, trends: null, leaderboards: null, fetchedAt: 0, error: null }),

  fetch: async ({ force = false } = {}) => {
    const state = get();
    const hasCache = state.fetchedAt > 0;

    // First load → blocking spinner. Subsequent loads → non-blocking refresh.
    if (hasCache && !force) {
      set({ refreshing: true, error: null });
    } else {
      set({ loading: true, error: null });
    }

    const [meRes, trendsRes, lbRes] = await Promise.allSettled([
      popularApi.getMyDashboard(),
      popularApi.getTrends(7),
      popularApi.getLeaderboards(10),
    ]);

    const next = {};
    if (meRes.status === 'fulfilled') next.dashboard = meRes.value.data;
    if (trendsRes.status === 'fulfilled') next.trends = trendsRes.value.data;
    if (lbRes.status === 'fulfilled') next.leaderboards = lbRes.value.data;

    const anyFailed = [meRes, trendsRes, lbRes].some((r) => r.status === 'rejected');

    set({
      ...next,
      loading: false,
      refreshing: false,
      fetchedAt: Date.now(),
      error: anyFailed && !hasCache ? 'fetch_failed' : null,
    });
  },
}));

export default usePopularStore;
