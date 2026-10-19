FROM python:3.11.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN groupadd --gid 10001 pythonlab \
    && useradd --uid 10001 --gid pythonlab --no-create-home --shell /usr/sbin/nologin pythonlab

WORKDIR /opt/python-runner
COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt
COPY api.py job.py ./
RUN chown -R root:root /opt/python-runner && chmod -R 0555 /opt/python-runner

USER 10001:10001
EXPOSE 4020
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4020/health', timeout=4)"
CMD ["python", "/opt/python-runner/api.py"]
