import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from graph.state import ViralEngineState
from graph.builder import create_initial_state
from models.material import MaterialGap, MaterialInventory, MaterialItem, MaterialType
from models.video_structure import ShotType
from agents.supervisor import SupervisorAgent
from agents.base import AgentRole, AgentStep, AgentResult
from config.llm_client import LLMTools


def test_initial_state_creation():
    state = create_initial_state(
        sample_videos=["vid1.mp4"],
        user_materials=[{"id": "img1", "type": "image", "path": "pic.jpg"}],
        target_topic="周末探店",
    )
    assert state["target_topic"] == "周末探店"
    assert state["phase"] == "init"
    assert state["is_complete"] is False
    assert state["iteration"] == 0
    assert state["max_iterations"] == 3
    assert state["current_task"] == {}
    assert len(state["sample_videos"]) == 1


def test_agent_role_enum():
    assert AgentRole.SUPERVISOR.value == "supervisor"
    assert AgentRole.ANALYST.value == "analyst"
    assert AgentRole.PLANNER.value == "planner"


def test_agent_step():
    step = AgentStep(step_index=0, thought="需要分析视频", action="get_video_info",
                     action_input={"video_path": "test.mp4"}, is_final=False)
    assert step.step_index == 0
    assert step.action == "get_video_info"
    assert step.action_input["video_path"] == "test.mp4"


def test_agent_result():
    result = AgentResult(success=True, message="任务完成", steps=[])
    assert result.success is True
    assert result.message == "任务完成"


def test_supervisor_has_role():
    llm = LLMTools()
    supervisor = SupervisorAgent(llm)
    assert supervisor.role == AgentRole.SUPERVISOR
    assert "analyst" in supervisor.system_prompt


def test_material_inventory_with_items():
    inv = MaterialInventory(
        items=[
            MaterialItem(id="img1", type=MaterialType.IMAGE, path="/a.jpg"),
            MaterialItem(id="vid1", type=MaterialType.VIDEO, path="/b.mp4"),
        ],
        gaps=[
            MaterialGap(slot_index=0, required_type=ShotType.HOOK, purpose="hook缺口", priority=5),
            MaterialGap(slot_index=1, required_type=ShotType.DAILY_MOMENT, purpose="日常缺口", priority=1),
        ],
    )
    assert len(inv.items) == 2
    assert len(inv.get_unfilled_gaps()) == 2
    assert len(inv.get_high_priority_gaps()) == 1


def test_material_inventory_face_items():
    from models.material import MaterialType, MaterialQuality
    item = MaterialItem(id="face1", type=MaterialType.IMAGE, path="/face.jpg", has_face=True)
    inv = MaterialInventory(items=[item])
    assert len(inv.get_face_items()) == 1


def test_material_gap_new_fields():
    gap = MaterialGap(
        slot_index=0,
        required_type=ShotType.HOOK,
        purpose="开场hook",
        priority=5,
        suggested_strategy="文字卡替代",
        impact_if_not_filled="观众会直接划走",
    )
    assert gap.required_type == ShotType.HOOK
    assert gap.priority == 5
    assert gap.suggested_strategy == "文字卡替代"
    assert not gap.is_filled
    d = gap.to_dict()
    assert d["required_type"] == "hook"
    assert d["purpose"] == "开场hook"


def test_phase_transitions():
    state = create_initial_state(sample_videos=[], user_materials=[], target_topic="test")
    assert state["phase"] == "init"
    state["phase"] = "analyst"
    assert state["phase"] == "analyst"
    state["phase"] = "materials"
    assert state["phase"] == "materials"
    state["phase"] = "planning"
    assert state["phase"] == "planning"
    state["phase"] = "gaps"
    assert state["phase"] == "gaps"
    state["phase"] = "assemble"
    assert state["phase"] == "assemble"
    state["phase"] = "review"
    assert state["phase"] == "review"
    state["phase"] = "complete"
    assert state["phase"] == "complete"


if __name__ == "__main__":
    from models.video_structure import ShotType
    test_initial_state_creation()
    test_agent_role_enum()
    test_agent_step()
    test_agent_result()
    test_supervisor_has_role()
    test_material_inventory_with_items()
    test_material_inventory_face_items()
    test_material_gap_new_fields()
    test_phase_transitions()
    print("All agent pipeline tests passed!")
