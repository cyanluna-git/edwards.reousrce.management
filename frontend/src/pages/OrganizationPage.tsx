import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useJobPositionsList,
  useCreateJobPosition,
  useUpdateJobPosition,
  useDeleteJobPosition,
} from "@/hooks/useJobPositionsCrud";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui";
import {
  getBusinessUnits,
  updateBusinessUnit,
  getDepartments,
  getSubTeams,
  updateDepartment,
  updateSubTeam,
  getUsers,
  getUserHistory,
  updateUser,
  getHiringPlans,
  createHiringPlan,
  deleteHiringPlan,
  type Department,
  type UserDetails,
} from "@/api/client";
import type { JobPosition } from "@/types";

type TabType = "teams" | "resources" | "positions" | "hiring";

export const OrganizationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("teams");

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">조직 관리</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: "teams" as TabType, label: "Teams" },
          { id: "resources" as TabType, label: "Resources" },
          { id: "positions" as TabType, label: "Job Positions" },
          { id: "hiring" as TabType, label: "Hiring Plans" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 -mb-px ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-600 font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "teams" && <TeamsTab />}
      {activeTab === "resources" && <ResourcesTab />}
      {activeTab === "positions" && <PositionsTab />}
      {activeTab === "hiring" && <HiringPlansTab />}
    </div>
  );
};

// ============================================================
// Teams Tab - Business Unit > Department > SubTeam Hierarchy
// ============================================================

const TeamsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedBUs, setExpandedBUs] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{
    type: "bu" | "dept" | "subteam";
    id: string;
    name: string;
  } | null>(null);

  const { data: businessUnits = [], isLoading: loadingBUs } = useQuery({
    queryKey: ["business-units"],
    queryFn: getBusinessUnits,
  });

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getDepartments(),
  });

  const updateBUMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateBusinessUnit(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-units"] });
      setEditingItem(null);
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateDepartment(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setEditingItem(null);
    },
  });

  const updateSubTeamMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateSubTeam(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-teams"] });
      setEditingItem(null);
    },
  });

  const toggleBU = (buId: string) => {
    const newSet = new Set(expandedBUs);
    if (newSet.has(buId)) newSet.delete(buId);
    else newSet.add(buId);
    setExpandedBUs(newSet);
  };

  const toggleDept = (deptId: string) => {
    const newSet = new Set(expandedDepts);
    if (newSet.has(deptId)) newSet.delete(deptId);
    else newSet.add(deptId);
    setExpandedDepts(newSet);
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editingItem.name.trim()) return;
    if (editingItem.type === "bu") {
      updateBUMutation.mutate({ id: editingItem.id, name: editingItem.name });
    } else if (editingItem.type === "dept") {
      updateDeptMutation.mutate({ id: editingItem.id, name: editingItem.name });
    } else {
      updateSubTeamMutation.mutate({
        id: editingItem.id,
        name: editingItem.name,
      });
    }
  };

  if (loadingBUs || loadingDepts)
    return <div className="text-center py-8">Loading...</div>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organization Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {businessUnits.map((bu) => {
              const buDepts = departments.filter(
                (d) => d.business_unit_id === bu.id
              );
              const isExpanded = expandedBUs.has(bu.id);

              return (
                <div key={bu.id} className="border rounded-lg">
                  {/* Business Unit Row */}
                  <div className="flex items-center justify-between p-3 bg-slate-100 cursor-pointer hover:bg-slate-200">
                    <div
                      className="flex items-center gap-2"
                      onClick={() => toggleBU(bu.id)}
                    >
                      <span className="text-lg">
                        {isExpanded ? "📂" : "📁"}
                      </span>
                      <span className="font-semibold">{bu.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({bu.code})
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {buDepts.length} teams
                      </span>
                    </div>
                    <button
                      className="text-blue-600 hover:underline text-xs px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem({
                          type: "bu",
                          id: bu.id,
                          name: bu.name,
                        });
                      }}
                    >
                      ✏️ 수정
                    </button>
                  </div>

                  {/* Departments under this BU */}
                  {isExpanded && buDepts.length > 0 && (
                    <div className="pl-6 py-2 space-y-1">
                      {buDepts.map((dept) => (
                        <DepartmentRow
                          key={dept.id}
                          department={dept}
                          isExpanded={expandedDepts.has(dept.id)}
                          onToggle={() => toggleDept(dept.id)}
                          onEdit={() =>
                            setEditingItem({
                              type: "dept",
                              id: dept.id,
                              name: dept.name,
                            })
                          }
                          onEditSubTeam={(st) =>
                            setEditingItem({
                              type: "subteam",
                              id: st.id,
                              name: st.name,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingItem && (
        <Dialog open onOpenChange={() => setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem.type === "dept"
                  ? "Department 수정"
                  : "Sub-Team 수정"}
              </DialogTitle>
              <DialogDescription>조직 정보를 수정합니다.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="block text-sm font-medium mb-1">이름</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={editingItem.name}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, name: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                취소
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editingItem.name.trim()}
              >
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

const DepartmentRow: React.FC<{
  department: Department;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onEditSubTeam: (st: { id: string; name: string }) => void;
}> = ({ department, isExpanded, onToggle, onEdit, onEditSubTeam }) => {
  const { data: subTeams = [] } = useQuery({
    queryKey: ["sub-teams", department.id],
    queryFn: () => getSubTeams(department.id),
    enabled: isExpanded,
  });

  return (
    <div className="border rounded bg-white">
      <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-50">
        <div className="flex items-center gap-2" onClick={onToggle}>
          <span>{isExpanded ? "📋" : "📄"}</span>
          <span className="font-medium">{department.name}</span>
          <span className="text-sm text-muted-foreground">
            ({department.code})
          </span>
        </div>
        <button
          className="text-blue-600 hover:underline text-xs px-2"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          ✏️ 수정
        </button>
      </div>

      {isExpanded && subTeams.length > 0 && (
        <div className="pl-6 pb-2 space-y-1">
          {subTeams.map((st) => (
            <div
              key={st.id}
              className="flex items-center justify-between gap-2 p-1 text-sm hover:bg-slate-50 rounded"
            >
              <div className="flex items-center gap-2">
                <span>👥</span>
                <span>{st.name}</span>
                <span className="text-muted-foreground">({st.code})</span>
              </div>
              <button
                className="text-blue-600 hover:underline text-xs px-2"
                onClick={() => onEditSubTeam({ id: st.id, name: st.name })}
              >
                ✏️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Resources Tab - User List with History
// ============================================================

const ResourcesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [editingUser, setEditingUser] = useState<UserDetails | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getDepartments(),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", selectedDeptId],
    queryFn: () => getUsers(selectedDeptId || undefined),
  });

  const { data: positions = [] } = useJobPositionsList();

  const getDeptName = (deptId: string) =>
    departments.find((d) => d.id === deptId)?.name || deptId;
  const getPositionName = (posId: string) =>
    positions.find((p) => p.id === posId)?.name || posId;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Resources ({users.length}명)</CardTitle>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3">Email</th>
                <th className="text-left py-2 px-3">Department</th>
                <th className="text-left py-2 px-3">Position</th>
                <th className="text-left py-2 px-3">Role</th>
                <th className="text-center py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-3">
                    <div className="font-medium">{user.name}</div>
                    {user.korean_name && (
                      <div className="text-xs text-muted-foreground">
                        {user.korean_name}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="py-2 px-3">
                    {getDeptName(user.department_id)}
                  </td>
                  <td className="py-2 px-3">
                    {getPositionName(user.position_id)}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        user.role === "ADMIN"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        user.is_active ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  </td>
                  <td className="py-2 px-3 text-right space-x-2">
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => setEditingUser(user)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="text-gray-600 hover:underline text-xs"
                      onClick={() => setSelectedUser(user)}
                    >
                      📋 History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      {/* User History Modal */}
      {selectedUser && (
        <UserHistoryModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* User Edit Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          departments={departments}
          positions={positions}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
    </Card>
  );
};

// User Edit Modal Component
const UserEditModal: React.FC<{
  user: UserDetails;
  departments: Department[];
  positions: JobPosition[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ user, departments, positions, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    department_id: user.department_id,
    sub_team_id: user.sub_team_id || "",
    position_id: user.position_id,
    role: user.role,
    is_active: user.is_active,
  });

  const { data: subTeams = [] } = useQuery({
    queryKey: ["sub-teams", formData.department_id],
    queryFn: () => getSubTeams(formData.department_id),
    enabled: !!formData.department_id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateUser>[1]) =>
      updateUser(user.id, data),
    onSuccess,
  });

  const handleSubmit = () => {
    updateMutation.mutate({
      department_id: formData.department_id,
      sub_team_id: formData.sub_team_id || null,
      position_id: formData.position_id,
      role: formData.role,
      is_active: formData.is_active,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Member: {user.name}</DialogTitle>
          <DialogDescription>사용자 정보를 수정합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-50"
              value={user.email}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Department *
            </label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.department_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  department_id: e.target.value,
                  sub_team_id: "",
                })
              }
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sub-Team</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.sub_team_id}
              onChange={(e) =>
                setFormData({ ...formData, sub_team_id: e.target.value })
              }
            >
              <option value="">None</option>
              {subTeams.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Job Position *
            </label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.position_id}
              onChange={(e) =>
                setFormData({ ...formData, position_id: e.target.value })
              }
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
            >
              <option value="USER">USER</option>
              <option value="PM">PM</option>
              <option value="FM">FM</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
            />
            <label htmlFor="is_active" className="text-sm">
              Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UserHistoryModal: React.FC<{
  user: UserDetails;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["user-history", user.id],
    queryFn: () => getUserHistory(user.id),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user.name} - History</DialogTitle>
          <DialogDescription>
            사용자의 변경 이력을 확인합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div>Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No history records
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-3 p-3 border rounded"
                >
                  <div
                    className={`w-3 h-3 rounded-full mt-1 ${
                      h.change_type === "HIRE"
                        ? "bg-green-500"
                        : h.change_type === "RESIGN"
                        ? "bg-red-500"
                        : h.change_type === "PROMOTION"
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{h.change_type}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(h.start_date).toLocaleDateString()}
                      {h.end_date &&
                        ` - ${new Date(h.end_date).toLocaleDateString()}`}
                    </div>
                    {h.remarks && (
                      <div className="text-sm mt-1">{h.remarks}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Job Positions Tab (simplified - global positions)
// ============================================================

const PositionsTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"functional" | "project">("functional");

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b">
        <button
          className={`px-4 py-2 -mb-px ${
            subTab === "functional"
              ? "border-b-2 border-blue-600 text-blue-600 font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setSubTab("functional")}
        >
          Functional Roles (조직 직책)
        </button>
        <button
          className={`px-4 py-2 -mb-px ${
            subTab === "project"
              ? "border-b-2 border-blue-600 text-blue-600 font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setSubTab("project")}
        >
          Project Roles (프로젝트 역할)
        </button>
      </div>

      {subTab === "functional" && <FunctionalRolesSection />}
      {subTab === "project" && <ProjectRolesSection />}
    </div>
  );
};

// Functional Roles Section (기존 JobPositions)
const FunctionalRolesSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(
    null
  );
  const [formName, setFormName] = useState("");

  const { data: positions = [], isLoading } = useJobPositionsList();
  const createPosition = useCreateJobPosition();
  const updatePosition = useUpdateJobPosition();
  const deletePosition = useDeleteJobPosition();

  const openAddModal = () => {
    setEditingPosition(null);
    setFormName("");
    setIsModalOpen(true);
  };

  const openEditModal = (position: JobPosition) => {
    setEditingPosition(position);
    setFormName(position.name);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (editingPosition) {
      await updatePosition.mutateAsync({
        id: editingPosition.id,
        data: { name: formName },
      });
    } else {
      await createPosition.mutateAsync({ name: formName });
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (position: JobPosition) => {
    if (!confirm(`"${position.name}" 직책을 삭제하시겠습니까?`)) return;
    await deletePosition.mutateAsync(position.id);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Functional Roles (조직 직책)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              회사에서 부여한 공식 직책 (예: Manager, Function Leader, Tech
              Lead, Senior Engineer)
            </p>
          </div>
          <Button onClick={openAddModal}>+ 추가</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-3 px-4">직책 이름</th>
                  <th className="text-right py-3 px-4 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{position.name}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        className="text-blue-600 hover:underline mr-3"
                        onClick={() => openEditModal(position)}
                      >
                        ✏️ 수정
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleDelete(position)}
                      >
                        🗑️ 삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? "직책 수정" : "새 직책 추가"}
            </DialogTitle>
            <DialogDescription>
              조직 내 공식 직책을 관리합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-1">
              직책 이름 *
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: Function Leader"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {editingPosition ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Project Roles Section (새로 추가)
const ProjectRolesSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    id: string;
    name: string;
    category?: string;
  } | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["project-roles"],
    queryFn: () => import("@/api/client").then((m) => m.getProjectRoles()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; category?: string }) =>
      import("@/api/client").then((m) => m.createProjectRole(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-roles"] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; category?: string };
    }) => import("@/api/client").then((m) => m.updateProjectRole(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-roles"] });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      import("@/api/client").then((m) => m.deleteProjectRole(id)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["project-roles"] }),
  });

  const openAddModal = () => {
    setEditingRole(null);
    setFormName("");
    setFormCategory("");
    setIsModalOpen(true);
  };

  const openEditModal = (role: {
    id: string;
    name: string;
    category?: string;
  }) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormCategory(role.category || "");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (editingRole) {
      await updateMutation.mutateAsync({
        id: editingRole.id,
        data: { name: formName, category: formCategory || undefined },
      });
    } else {
      await createMutation.mutateAsync({
        name: formName,
        category: formCategory || undefined,
      });
    }
  };

  const handleDelete = async (role: { id: string; name: string }) => {
    if (!confirm(`"${role.name}" 역할을 삭제하시겠습니까?`)) return;
    await deleteMutation.mutateAsync(role.id);
  };

  const categories = ["Engineering", "Management", "Support"];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Project Roles (프로젝트 역할)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              프로젝트에서 수행하는 기술적 역할 (예: SW Engineer, HW Engineer,
              PM)
            </p>
          </div>
          <Button onClick={openAddModal}>+ 추가</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-3 px-4">역할 이름</th>
                  <th className="text-left py-3 px-4">카테고리</th>
                  <th className="text-center py-3 px-4">할당 인원</th>
                  <th className="text-center py-3 px-4">프로젝트</th>
                  <th className="text-right py-3 px-4 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{role.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          role.category === "Engineering"
                            ? "bg-blue-100 text-blue-700"
                            : role.category === "Management"
                            ? "bg-purple-100 text-purple-700"
                            : role.category === "Support"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {role.category || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-blue-600 font-medium">
                        {role.user_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-green-600 font-medium">
                        {role.project_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        className="text-blue-600 hover:underline mr-3"
                        onClick={() => openEditModal(role)}
                      >
                        ✏️ 수정
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleDelete(role)}
                      >
                        🗑️ 삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "역할 수정" : "새 역할 추가"}
            </DialogTitle>
            <DialogDescription>
              프로젝트에서 수행하는 역할을 관리합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                역할 이름 *
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: Software Engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">카테고리</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                <option value="">선택 안함</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formName.trim() ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingRole ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ============================================================
// Hiring Plans Tab
// ============================================================

const HiringPlansTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: hiringPlans = [], isLoading } = useQuery({
    queryKey: ["hiring-plans"],
    queryFn: () => getHiringPlans(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getDepartments(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHiringPlan,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["hiring-plans"] }),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLANNED":
        return "bg-gray-100 text-gray-700";
      case "APPROVED":
        return "bg-blue-100 text-blue-700";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-700";
      case "FILLED":
        return "bg-green-100 text-green-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100";
    }
  };

  const getDeptName = (deptId: string) => {
    return departments.find((d) => d.id === deptId)?.name || deptId;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hiring Plans ({hiringPlans.length})</CardTitle>
          <Button onClick={() => setIsModalOpen(true)}>+ 새 채용 계획</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : hiringPlans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 채용 계획이 없습니다.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-2 px-3">Target Date</th>
                  <th className="text-left py-2 px-3">Department</th>
                  <th className="text-center py-2 px-3">Headcount</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Remarks</th>
                  <th className="text-right py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hiringPlans.map((plan) => (
                  <tr key={plan.id} className="border-b hover:bg-slate-50">
                    <td className="py-2 px-3">{plan.target_date}</td>
                    <td className="py-2 px-3">
                      {getDeptName(plan.department_id)}
                    </td>
                    <td className="py-2 px-3 text-center font-medium">
                      {plan.headcount}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${getStatusColor(
                          plan.status
                        )}`}
                      >
                        {plan.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {plan.remarks || "-"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        className="text-red-600 hover:underline text-xs"
                        onClick={() => {
                          if (confirm("삭제하시겠습니까?")) {
                            deleteMutation.mutate(plan.id);
                          }
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <HiringPlanModal
          departments={departments}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["hiring-plans"] });
          }}
        />
      )}
    </>
  );
};

const HiringPlanModal: React.FC<{
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ departments, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    department_id: "",
    target_date: "",
    headcount: 1,
    status: "PLANNED",
    remarks: "",
  });

  const createMutation = useMutation({
    mutationFn: createHiringPlan,
    onSuccess,
  });

  const handleSubmit = () => {
    if (!formData.department_id || !formData.target_date) return;
    createMutation.mutate({
      department_id: formData.department_id,
      position_id: null,
      target_date: formData.target_date,
      headcount: formData.headcount,
      status: formData.status,
      remarks: formData.remarks || null,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 채용 계획</DialogTitle>
          <DialogDescription>새로운 채용 계획을 등록합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Department *
            </label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.department_id}
              onChange={(e) =>
                setFormData({ ...formData, department_id: e.target.value })
              }
            >
              <option value="">Select...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Target Date *
            </label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={formData.target_date}
              onChange={(e) =>
                setFormData({ ...formData, target_date: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Headcount</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded px-3 py-2"
              value={formData.headcount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  headcount: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
            >
              <option value="PLANNED">PLANNED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Remarks</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={formData.remarks}
              onChange={(e) =>
                setFormData({ ...formData, remarks: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.department_id ||
              !formData.target_date ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationPage;
