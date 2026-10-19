import { api, unwrap, type components } from '@/lib/api';

export type Mission = components['schemas']['MissionDto'];
export type MissionsView = components['schemas']['MissionsResponse'];
export type Achievement = components['schemas']['AchievementDto'];
export type AchievementsView = components['schemas']['AchievementsResponse'];
export type SeasonPassView = components['schemas']['SeasonPassResponse'];
export type SeasonTier = components['schemas']['TierDto'];
export type Reward = components['schemas']['RewardDto'];
export type ClaimResult = components['schemas']['ClaimResponse'];

export const fetchMissions = () => unwrap(api.GET('/api/v1/missions'));

export const claimMission = (missionId: string) =>
  unwrap(api.POST('/api/v1/missions/{missionId}/claim', { params: { path: { missionId } } }));

export const fetchAchievements = () => unwrap(api.GET('/api/v1/achievements'));

export const fetchSeasonPass = () => unwrap(api.GET('/api/v1/season-pass'));

export const claimSeasonTier = (tier: number) =>
  unwrap(api.POST('/api/v1/season-pass/{tier}/claim', { params: { path: { tier } } }));
