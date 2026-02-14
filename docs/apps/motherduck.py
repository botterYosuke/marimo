import marimo

__generated_with = "0.19.11"
app = marimo.App(width="grid")


@app.cell
def _():
    import marimo as mo
    import duckdb

    return duckdb, mo


@app.cell
def _(duckdb):
    duckdb.sql(
        "ATTACH 'md:_share/sample_data/23b0d623-1361-421d-ae77-62d701d471e6' AS sample_data"
    )
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Reactive SQL
    """)
    return


@app.cell
def _(mo):
    last_x_months = mo.ui.slider(24, 30, label="Last x months")
    last_x_months
    return (last_x_months,)


@app.cell
def _(last_x_months, mo):
    recent_hacker_news = mo.sql(
        f"""
        FROM sample_data.hn.hacker_news 
        WHERE timestamp >= (CURRENT_DATE - INTERVAL {last_x_months.value} month)
        AND type = 'story'
        """
    )
    return (recent_hacker_news,)


@app.cell
def _(mo, recent_hacker_news):
    aggregations = mo.sql(
        f"""
        SELECT 
          COUNT(*) AS total_posts, AVG(score) AS avg_score,
          MAX(score) AS max_score, MIN(score) AS min_score,
        FROM recent_hacker_news WHERE score IS NOT NULL;
        """
    )
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Mix and match Python
    """)
    return


@app.cell
def _(mo):
    agency_tickets = mo.sql(
        f"""
        SELECT 
          agency_name,
          COUNT(*) AS num_requests,
          CAST(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS INT64) AS closed_count,
          CAST(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS INT64) AS open_count
        FROM sample_data.nyc.service_requests
        GROUP BY agency_name ORDER BY closed_count DESC LIMIT 20
        """
    )
    return (agency_tickets,)


@app.cell
def _(agency_tickets):
    import altair as alt

    scale = alt.Scale(type="sqrt")
    base = (
        alt.Chart(agency_tickets)
        .encode(y="agency_name", x=alt.X("num_requests", scale=scale))
        .properties(width="container")
    )
    chart_closed = base.mark_bar(color="#FFC080").encode(
        x=alt.X("closed_count", scale=scale)
    )
    chart_open = base.mark_bar(color="#8BC34A").encode(
        x=alt.X("open_count", scale=scale)
    )
    chart_closed + chart_open
    return


if __name__ == "__main__":
    app.run()
