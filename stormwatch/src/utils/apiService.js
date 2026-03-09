import { getApiBaseURL } from './config';

const API_BASE_URL = getApiBaseURL();

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
      if (error.message.includes('404')) {
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

  async getClerkUsers() {
    return this.request('/clerk/users');
  }

  async updateClerkUserRole(payload) {
    return this.request('/clerk/users/role', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

const apiService = new ApiService();
export default apiService;

export { ApiService };
