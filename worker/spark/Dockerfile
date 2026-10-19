FROM python:3.11.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    SPARK_LOCAL_IP=127.0.0.1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless bubblewrap \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 spark \
    && useradd --uid 10001 --gid spark --no-create-home --shell /usr/sbin/nologin spark

WORKDIR /opt/spark-runner
COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt
COPY api.py job.py ./
RUN chown -R root:root /opt/spark-runner && chmod -R 0555 /opt/spark-runner

USER 10001:10001
EXPOSE 4021
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4021/health', timeout=4)"
CMD ["python", "/opt/spark-runner/api.py"]