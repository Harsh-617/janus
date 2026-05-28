import logging
from contextlib import contextmanager
from typing import Any, Generator

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

from config import settings

logger = logging.getLogger(__name__)


def setup_tracing() -> TracerProvider | None:
    try:
        resource = Resource.create({"service.name": "janus"})
        exporter = OTLPSpanExporter(endpoint=settings.PHOENIX_COLLECTOR_ENDPOINT)
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        try:
            from openinference.instrumentation.langchain import LangChainInstrumentor
            LangChainInstrumentor().instrument()
        except ImportError:
            logger.warning("openinference-instrumentation-langchain not available; LangChain auto-instrumentation skipped")

        logger.info("Phoenix tracing initialized")
        return provider
    except Exception as exc:
        logger.warning("Phoenix tracing setup failed — running without traces: %s", exc)
        return None


def get_tracer(name: str = "janus") -> trace.Tracer:
    return trace.get_tracer(name)


@contextmanager
def trace_agent_call(agent_name: str, cycle_id: str) -> Generator[trace.Span, None, None]:
    tracer = get_tracer()
    with tracer.start_as_current_span(f"agent.{agent_name}") as span:
        span.set_attribute("agent.name", agent_name)
        span.set_attribute("cycle.id", cycle_id)
        span.set_attribute("janus.component", "agent")
        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            raise


def record_cycle_start(cycle_id: str) -> Any:
    tracer = get_tracer()
    span = tracer.start_span(f"decision_cycle.{cycle_id}")
    span.set_attribute("cycle.id", cycle_id)
    span.set_attribute("janus.component", "cycle")
    return span


tracer = get_tracer()


def get_current_span_id_hex() -> str:
    """Return the active OTel span ID as a 16-char lowercase hex string, or '' if unavailable."""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx and ctx.span_id:
        return format(ctx.span_id, '016x')
    return ""
