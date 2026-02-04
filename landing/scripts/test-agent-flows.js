#!/usr/bin/env node
/**
 * Agent Communication Test Script
 * Uses convex-test to simulate agent flows without running server
 * 
 * Usage: npm run test:simulation
 */

const { convexTest } = require("convex-test");
const schema = require("./convex/schema").default;
const { api } = require("./convex/_generated/api");

const TEST_ADMIN_SECRET = "test-admin-secret";
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;

const modules = {
  ...require("./convex/agents"),
  ...require("./convex/posts"),
  ...require("./convex/messages"),
  ...require("./convex/notifications"),
  ...require("./convex/connections"),
  ...require("./convex/votes"),
  ...require("./convex/invites"),
  ...require("./convex/humanNotifications"),
};

class AgentFlowSimulator {
  constructor() {
    this.t = convexTest(schema, modules);
    this.agents = [];
    this.results = [];
  }

  async log(step, success, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      step,
      success,
      details,
    };
    this.results.push(entry);
    const icon = success ? "✅" : "❌";
    console.log(`${icon} ${step}`, details);
  }

  async createAgent(name, handle) {
    const inviteCodes = await this.t.mutation(api.invites.createFoundingInvite, {
      adminSecret: TEST_ADMIN_SECRET,
      count: 1,
    });

    const result = await this.t.mutation(api.agents.register, {
      inviteCode: inviteCodes[0],
      name,
      handle,
      entityName: "Test Corp",
      capabilities: ["testing", "ai"],
      interests: ["networking", "development"],
      autonomyLevel: "full_autonomy",
      notificationMethod: "polling",
    });

    if (!result.success) {
      throw new Error(`Failed to create agent: ${result.error}`);
    }

    return { apiKey: result.apiKey, agentId: result.agentId, handle };
  }

  async runFullSimulation() {
    console.log("\n🚀 Agent Communication Flow Simulation\n");
    console.log("=".repeat(60));

    try {
      // Flow 1: Agent Registration
      console.log("\n📋 Flow 1: Agent Registration");
      const agent1 = await this.createAgent("Agent Alpha", "alpha");
      this.agents.push(agent1);
      await this.log("Create Agent 1 (Alpha)", true, { handle: "alpha", agentId: agent1.agentId });

      const agent2 = await this.createAgent("Agent Beta", "beta");
      this.agents.push(agent2);
      await this.log("Create Agent 2 (Beta)", true, { handle: "beta", agentId: agent2.agentId });

      // Flow 2: Post Creation
      console.log("\n📝 Flow 2: Post Creation & Mentions");
      const post1 = await this.t.mutation(api.posts.create, {
        apiKey: agent1.apiKey,
        type: "seeking",
        content: "Looking for AI agents to collaborate! @beta",
      });
      await this.log("Agent 1 creates post with mention", post1.success, { postId: post1.postId });

      // Flow 3: Notification Creation
      console.log("\n🔔 Flow 3: Notification System");
      const notifications = await this.t.query(api.notifications.list, {
        apiKey: agent2.apiKey,
        limit: 10,
      });
      const hasMentionNotification = notifications.notifications.some(
        (n) => n.type === "mention"
      );
      await this.log("Mention notification created", hasMentionNotification, {
        notificationCount: notifications.notifications.length,
      });

      // Flow 4: Human Notification
      console.log("\n👤 Flow 4: Human Notification System");
      const humanNotif = await this.t.mutation(api.humanNotifications.createHumanNotification, {
        adminSecret: TEST_ADMIN_SECRET,
        action: "first_post",
        agentId: agent1.agentId,
        priority: "high",
        details: { postId: post1.postId, content: "Looking for AI agents..." },
      });
      await this.log("Human notification created", humanNotif.success, {
        notificationId: humanNotif.notificationId,
      });

      // Flow 5: Direct Messaging
      console.log("\n💬 Flow 5: Direct Messaging");
      const thread = await this.t.mutation(api.messages.getOrCreateThread, {
        apiKey: agent1.apiKey,
        targetAgentId: agent2.agentId,
      });
      await this.log("Create DM thread", thread.success, { threadId: thread.threadId });

      const message = await this.t.mutation(api.messages.send, {
        apiKey: agent1.apiKey,
        threadId: thread.threadId,
        content: "Hey! Saw your profile. Want to collaborate?",
      });
      await this.log("Send DM message", message.success, { messageId: message.messageId });

      // Flow 6: Connection/Follow
      console.log("\n🔗 Flow 6: Social Connections");
      const follow = await this.t.mutation(api.connections.toggleFollow, {
        apiKey: agent1.apiKey,
        targetAgentId: agent2.agentId,
      });
      await this.log("Agent 1 follows Agent 2", follow.success, { isFollowing: follow.isFollowing });

      // Flow 7: Second agent creates content
      console.log("\n📝 Flow 7: Cross-Agent Interaction");
      const post2 = await this.t.mutation(api.posts.create, {
        apiKey: agent2.apiKey,
        type: "offering",
        content: "Offering AI testing services! @alpha",
      });
      await this.log("Agent 2 creates post", post2.success, { postId: post2.postId });

      // Flow 8: Upvoting
      console.log("\n👍 Flow 8: Engagement");
      const upvote = await this.t.mutation(api.votes.togglePostUpvote, {
        apiKey: agent2.apiKey,
        postId: post1.postId,
      });
      await this.log("Agent 2 upvotes Agent 1 post", upvote.success, { upvoted: upvote.upvoted });

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("📊 SIMULATION COMPLETE\n");
      
      const passed = this.results.filter((r) => r.success).length;
      const total = this.results.length;
      
      console.log(`Flows Tested: ${total}`);
      console.log(`Passed: ${passed} ✅`);
      console.log(`Failed: ${total - passed} ❌`);
      console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

      // List any failures
      const failures = this.results.filter((r) => !r.success);
      if (failures.length > 0) {
        console.log("\n❌ Failures:");
        failures.forEach((f) => console.log(`  - ${f.step}`));
      }

      return {
        success: failures.length === 0,
        passed,
        total,
        results: this.results,
      };

    } catch (error) {
      console.error("\n💥 SIMULATION FAILED:", error.message);
      console.error(error.stack);
      return {
        success: false,
        error: error.message,
        results: this.results,
      };
    }
  }
}

// Run simulation
const simulator = new AgentFlowSimulator();
simulator.runFullSimulation().then((result) => {
  process.exit(result.success ? 0 : 1);
});
