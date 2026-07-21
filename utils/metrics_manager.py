import os
import json
import logging

logger = logging.getLogger('smartdocs.metrics')

DEFAULT_METRICS = {
    "total_questions": 0,
    "total_retrieval_time_ms": 0,
    "total_generation_time_ms": 0,
    "average_retrieval_time_ms": 0,
    "average_generation_time_ms": 0,
    "voice_queries": 0,
    "total_transcription_time_ms": 0,
    "average_transcription_time_ms": 0,
    "documents_summarized": 0,
    "reports_generated": 0,
    "comparisons_completed": 0,
    "knowledge_graph_nodes": 0,
    "faqs_generated": 0,
    "action_items_detected": 0
}

def get_metrics_file_path():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    metadata_dir = os.path.join(base_dir, "metadata")
    os.makedirs(metadata_dir, exist_ok=True)
    return os.path.join(metadata_dir, "metrics.json")

def load_metrics() -> dict:
    path = get_metrics_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k, v in DEFAULT_METRICS.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception:
            return DEFAULT_METRICS.copy()
    else:
        save_metrics(DEFAULT_METRICS)
        return DEFAULT_METRICS.copy()

def save_metrics(metrics: dict):
    path = get_metrics_file_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=4, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving metrics: {e}")

def record_question(retrieval_time_ms: int, generation_time_ms: int):
    metrics = load_metrics()
    metrics["total_questions"] += 1
    metrics["total_retrieval_time_ms"] += retrieval_time_ms
    metrics["total_generation_time_ms"] += generation_time_ms
    
    # Calculate averages
    tq = metrics["total_questions"]
    metrics["average_retrieval_time_ms"] = round(metrics["total_retrieval_time_ms"] / tq, 1)
    metrics["average_generation_time_ms"] = round(metrics["total_generation_time_ms"] / tq, 1)
    
    save_metrics(metrics)

def record_voice_query(transcription_time_ms: int):
    metrics = load_metrics()
    metrics["voice_queries"] += 1
    metrics["total_transcription_time_ms"] += transcription_time_ms
    
    vq = metrics["voice_queries"]
    metrics["average_transcription_time_ms"] = round(metrics["total_transcription_time_ms"] / vq, 1)
    
    save_metrics(metrics)

def record_summary_count(count: int = 1):
    metrics = load_metrics()
    metrics["documents_summarized"] = metrics.get("documents_summarized", 0) + count
    save_metrics(metrics)

def record_report_generated():
    metrics = load_metrics()
    metrics["reports_generated"] = metrics.get("reports_generated", 0) + 1
    save_metrics(metrics)

def record_comparison_completed():
    metrics = load_metrics()
    metrics["comparisons_completed"] = metrics.get("comparisons_completed", 0) + 1
    save_metrics(metrics)

def record_knowledge_graph_nodes(count: int):
    metrics = load_metrics()
    metrics["knowledge_graph_nodes"] = max(metrics.get("knowledge_graph_nodes", 0), count)
    save_metrics(metrics)

def record_faqs_generated(count: int):
    metrics = load_metrics()
    metrics["faqs_generated"] = metrics.get("faqs_generated", 0) + count
    save_metrics(metrics)

def record_action_items_detected(count: int):
    metrics = load_metrics()
    metrics["action_items_detected"] = metrics.get("action_items_detected", 0) + count
    save_metrics(metrics)

