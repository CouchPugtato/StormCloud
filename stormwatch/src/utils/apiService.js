import { getApiBaseURL } from './config';

const API_BASE_URL = getApiBaseURL();

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.authToken = null;
  }

  setAuthToken(token) {
    this.authToken = token || null;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload?.error) {
            errorMessage = errorPayload.error;
          }
        } catch (_) {
          // no-op, keep default message
        }
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async searchTeams(query) {
    if (!query || query.trim() === '') {
      return [];
    }
    return this.request(`/teams?search=${encodeURIComponent(query.trim())}`);
  }

  async getTeam(teamKey) {
    return this.request(`/teams/${teamKey}`);
  }

  async getTeamSchedule(teamKey, eventKey) {
    return this.request(`/teams/${teamKey}/schedule?event=${eventKey}`);
  }

  async getTeamNotes(teamKey) {
    return this.request(`/teams/${teamKey}/notes`);
  }

  async updateTeamNotes(teamKey, data) {
    return this.request(`/teams/${teamKey}/notes`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getEvents() {
    return this.request('/events');
  }

  async getEvent(eventKey) {
    return this.request(`/events/${eventKey}`);
  }

  async getEventMatches(eventKey) {
    return this.request(`/events/${eventKey}/matches`);
  }

  async submitMatchScoutingData(data) {
    return this.request('/match-scouting', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMatchScoutingData(matchKey, teamKey) {
    return this.request(`/match-scouting/${matchKey}/${teamKey}`);
  }

  async getTeamMatchScoutingData(teamKey) {
    try {
      return await this.request(`/teams/${teamKey}/match-scouting`);
    } catch (error) {
      // 404 is expected when no data exists yet
      if (error.message.includes('404')) {
        return [];
      }
      throw error;
    }
  }

  async submitPitScoutingData(data) {
    return this.request('/pit-scouting', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPitScoutingData(teamKey, eventKey) {
    try {
      return await this.request(`/pit-scouting/${teamKey}/${eventKey}`);
    } catch (error) {
      if (
        error.message.includes('404') ||
        error.message.toLowerCase().includes('no pit scouting data found')
      ) {
        return null; 
      }
      throw error; 
    }
  }

  async getAllTeams() {
    try {
      return await this.request('/teams?limit=100');
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      return [];
    }
  }

  async addTeamFromTBA(teamNum) {
    return this.request('/teams/add-from-tba', {
      method: 'POST',
      body: JSON.stringify({ team_num: Number(teamNum) }),
    });
  }

  async getTeamsEPA(teamKeys) {
    if (!teamKeys || teamKeys.length === 0) {
      return {};
    }
    
    try {
      const epaPromises = teamKeys.map(async (teamKey) => {
        try {
          const teamData = await this.getTeam(teamKey);
          const epaData = teamData.EPA || teamData.epa || {};
          const epaValue = epaData.epa_end || epaData.epa || 0;
          
          return {
            teamKey,
            epa: epaValue
          };
        } catch (error) {
          console.warn(`Failed to fetch EPA for team ${teamKey}:`, error);
          return {
            teamKey,
            epa: 0
          };
        }
      });
      
      const epaResults = await Promise.all(epaPromises);
      
      const epaMap = {};
      epaResults.forEach(result => {
        epaMap[result.teamKey] = result.epa;
      });
      
      return epaMap;
    } catch (error) {
      console.error('Failed to fetch EPA data:', error);
      return {};
    }
  }

  // Pick list endpoints
  async getPickList(eventKey = '') {
    const q = eventKey && eventKey.trim() !== '' ? `?event_key=${encodeURIComponent(eventKey.trim())}` : '';
    return this.request(`/pick-list${q}`);
  }

  async savePickList(eventKey = '', items = []) {
    return this.request('/pick-list', {
      method: 'POST',
      body: JSON.stringify({ event_key: eventKey || '', items }),
    });
  }

  async registerDeviceToken(payload) {
    return this.request('/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async unregisterDeviceToken(payload) {
    return this.request('/devices/unregister', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPushPublicKey() {
    return this.request('/push/public-key');
  }

  async subscribeWebPush(payload) {
    return this.request('/push/subscribe-web', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async unsubscribeWebPush(payload) {
    return this.request('/push/unsubscribe-web', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendTestPush(payload) {
    return this.request('/push/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async authRegister(payload) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async authLogin(payload) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async authMe() {
    return this.request('/auth/me');
  }

  async authLogout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getAppSettings() {
    return this.request('/app-settings');
  }

  async updateAppSettings(payload) {
    return this.request('/app-settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getUsers() {
    return this.request('/users');
  }

  async updateUserRole(payload) {
    return this.request('/users/role', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

const apiService = new ApiService();
export default apiService;

export { ApiService };
