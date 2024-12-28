const { nanoid } = require("nanoid")

module.exports = class PermissionManager {
    constructor({ oyster, config, managers }) {
        this.oyster = oyster
        this.config = config
        this.permissionPrefix = "permission"
        this.rolePrefix = "role"
    }

    async assignRole({ userId, role }) {
        return this.oyster.call("update_relations", {
            _id: `user:${userId}`,
            set: {
                _roles: [`role:${role}`],
            },
        })
    }

    async getRoles({ userId }) {
        const roles = await this.oyster.call("nav_relation", {
            relation: "_roles",
            _id: `user:${userId}`,
            withScores: true,
        })
        return Object.keys(roles).map((role) => role.split(":")[1])
    }

    async hasPermission({ userId, resource, action }) {
        const roles = await this.getRoles({ userId })

        // Check each role's permissions
        for (const role of roles) {
            const permissions = await this.oyster.call("nav_relation", {
                relation: "_permissions",
                _id: `role:${role}`,
                withScores: true,
            })

            const permissionKey = `${resource}:${action}`
            if (permissions[permissionKey]) {
                return true
            }
        }

        return false
    }

    async createRole({ role, permissions }) {
        // Create role with permissions
        await this.oyster.call("add_block", {
            _id: `role:${role}`,
            _label: this.rolePrefix,
            name: role,
        })

        // Assign permissions to role
        if (permissions && permissions.length > 0) {
            const permissionRelations = permissions.map((p) => `${p.resource}:${p.action}`)
            await this.oyster.call("update_relations", {
                _id: `role:${role}`,
                set: {
                    _permissions: permissionRelations,
                },
            })
        }
    }

    async removeRole({ role }) {
        return this.oyster.call("delete_block", `role:${role}`)
    }
}
