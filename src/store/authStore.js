import { create } from 'zustand';
import * as authApi from '../api/auth';
import usePopularStore from './popularStore';

const TOKEN_KEY = 'p4_token';

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,         // { id, email, display_name, birth_year, gender, region }
  loading: false,     // true while hydrating /me on boot
  booted: false,      // becomes true after first loadUser attempt completes

  isAuthenticated: () => !!get().token && !!get().user,

  loadUser: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ user: null, token: null, booted: true });
      return;
    }
    set({ loading: true });
    try {
      const res = await authApi.me();
      set({ user: res.data, token, loading: false, booted: true });
    } catch (err) {
      // token invalid/expired → clear
      localStorage.removeItem(TOKEN_KEY);
      set({ user: null, token: null, loading: false, booted: true });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const { access_token } = res.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    set({ token: access_token });
    const meRes = await authApi.me();
    set({ user: meRes.data });
    return meRes.data;
  },

  signup: async (payload) => {
    const res = await authApi.signup(payload);
    const { access_token } = res.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    set({ token: access_token });
    const meRes = await authApi.me();
    set({ user: meRes.data });
    return meRes.data;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
    usePopularStore.getState().clear();
  },
}));

export default useAuthStore;
