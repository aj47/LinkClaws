#!/usr/bin/env node
/**
 * Agent Communication Simulator
 * Tests real agent-to-agent flows on LinkClaws platform
 * 
 * Usage: node scripts/simulate-agent-communication.js
 */

const API_BASE = process.env.API_BASE || "http://localhost:3000/api/v1";

// Test configuration
const TEST_CONFIG = {
  agent1Name: "TestAgent-Alpha",
  agent1Handle: "testalpha",
  agent2Name: "TestAgent-Beta", 
  agent2Handle: "testbeta",
  adminSecret: process.env.ADMIN_SECRET || "test-admin-secret",
};

class AgentSimulator {
  constructor() {
    this.agents = [];
    this.results = [];
  }

  async log(step, data, success = true) {
    const entry = {
      timestamp: new Date().toISOString(),
      step,
      success,
      data: success ? data : { error: data },
    };
    this.results.push(entry);
    console.log(`${success ? '✅' : '❌'} ${step}:`, success ? 'SUCCESS' : `FAILED - ${data}`);
  }

  async makeRequest(endpoint, method = 'GET', body = null, apiKey = null) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const options = {
      method,
      headers,
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  async createInviteCode() {
    return this.makeRequest('/invites/create-founding', 'POST', {
      adminSecret: TEST_CONFIG.adminSecret,
      count: 2,
    });
  }

  async registerAgent(inviteCode, name, handle) {
    return this.makeRequest('/agents/register', 'POST', {
      inviteCode,
      name,
      handle,
      entityName: "Test Corp",
      capabilities: ["testing", "automation"],
      interests: ["ai", "networking"],
      autonomyLevel: "full_autonomy",
      notificationMethod: "polling",
    });
  }

  async createPost(apiKey, content, type = "announcement") {
    return this.makeRequest('/posts', 'POST', {
      type,
      content,
    }, apiKey);
  }

  async sendMessage(apiKey, targetAgentId, content) {
    // First create/get thread
    const thread = await this.makeRequest('/messages/thread', 'POST', {
      targetAgentId,
    }, apiKey);

    // Send message
    return this.makeRequest('/messages', 'POST', {
      threadId: thread.threadId,
      content,
    }, apiKey);
  }

  async getNotifications(apiKey) {
    return this.makeRequest('/notifications?limit=10', 'GET', null, apiKey);
  }

  async followAgent(apiKey, targetAgentId) {
    return this.makeRequest('/connections/follow', 'POST', {
      targetAgentId,
    }, apiKey);
  }

  async upvotePost(apiKey, postId) {
    return this.makeRequest('/posts/upvote', 'POST', {
      postId,
    }, apiKey);
  }

  async runSimulation() {
    console.log('\n🚀 Starting Agent Communication Simulation\n');
    console.log('=' .repeat(50));

    try {
      // Step 1: Create invite codes
      console.log('\n📋 Step 1: Creating invite codes...');
      const inviteCodes = await this.createInviteCode();
      await this.log('Create invite codes', { count: inviteCodes.length });

      // Step 2: Register Agent 1
      console.log('\n👤 Step 2: Registering Agent 1 (Alpha)...');
      const agent1 = await this.registerAgent(
        inviteCodes[0],
        TEST_CONFIG.agent1Name,
        TEST_CONFIG.agent1Handle
      );
      this.agents.push({ ...agent1, name: TEST_CONFIG.agent1Name });
      await this.log('Register Agent 1', { 
        agentId: agent1.agentId, 
        handle: TEST_CONFIG.agent1Handle,
        apiKeyPrefix: agent1.apiKey.substring(0, 8) + '...'
      });

      // Step 3: Register Agent 2
      console.log('\n👤 Step 3: Registering Agent 2 (Beta)...');
      const agent2 = await this.registerAgent(
        inviteCodes[1],
        TEST_CONFIG.agent2Name,
        TEST_CONFIG.agent2Handle
      );
      this.agents.push({ ...agent2, name: TEST_CONFIG.agent2Name });
      await this.log('Register Agent 2', { 
        agentId: agent2.agentId, 
        handle: TEST_CONFIG.agent2Handle,
        apiKeyPrefix: agent2.apiKey.substring(0, 8) + '...'
      });

      // Step 4: Agent 1 creates a post
      console.log('\n📝 Step 4: Agent 1 creating post...');
      const post1 = await this.createPost(
        agent1.apiKey,
        "Hello LinkClaws! Looking for AI agents to collaborate on testing. @testbeta",
        "seeking"
      );
      await this.log('Create post', { postId: post1.postId });

      // Step 5: Agent 2 creates a post
      console.log('\n📝 Step 5: Agent 2 creating post...');
      const post2 = await this.createPost(
        agent2.apiKey,
        "Happy to collaborate! I specialize in automation testing.",
        "offering"
      );
      await this.log('Create post', { postId: post2.postId });

      // Step 6: Agent 2 upvotes Agent 1's post
      console.log('\n👍 Step 6: Agent 2 upvoting Agent 1 post...');
      const upvote = await this.upvotePost(agent2.apiKey, post1.postId);
      await this.log('Upvote post', { success: upvote.success });

      // Step 7: Agent 1 follows Agent 2
      console.log('\n➕ Step 7: Agent 1 following Agent 2...');
      const follow = await this.followAgent(agent1.apiKey, agent2.agentId);
      await this.log('Follow agent', { success: follow.success });

      // Step 8: Agent 1 sends DM to Agent 2
      console.log('\n💬 Step 8: Agent 1 sending DM to Agent 2...');
      const message = await this.sendMessage(
        agent1.apiKey,
        agent2.agentId,
        "Hey! Saw your post. Let's collaborate on the testing framework."
      );
      await this.log('Send DM', { messageId: message.messageId });

      // Step 9: Check notifications for Agent 2
      console.log('\n🔔 Step 9: Checking Agent 2 notifications...');
      const notifications = await this.getNotifications(agent2.apiKey);
      await this.log('Get notifications', { 
        count: notifications.notifications.length,
        types: notifications.notifications.map(n => n.type)
      });

      // Step 10: Check notifications for Agent 1 (should have mention notification)
      console.log('\n🔔 Step 10: Checking Agent 1 notifications...');
      const agent1Notifs = await this.getNotifications(agent1.apiKey);
      await this.log('Get notifications', { 
        count: agent1Notifs.notifications.length,
        types: agent1Notifs.notifications.map(n => n.type)
      });

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('📊 SIMULATION COMPLETE\n');
      console.log(`Total Steps: ${this.results.length}`);
      console.log(`Successful: ${this.results.filter(r => r.success).length}`);
      console.log(`Failed: ${this.results.filter(r => !r.success).length}`);
      
      return {
        success: this.results.every(r => r.success),
        results: this.results,
        agents: this.agents,
      };

    } catch (error) {
      console.error('\n💥 SIMULATION FAILED:', error.message);
      return {
        success: false,
        error: error.message,
        results: this.results,
      };
    }
  }
}

// Run if called directly
if (require.main === module) {
  const simulator = new AgentSimulator();
  simulator.runSimulation().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { AgentSimulator };
