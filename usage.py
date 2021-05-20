import dash_recorder
import dash
from dash.dependencies import Input, Output
import dash_html_components as html
import struct

app = dash.Dash(__name__)

app.layout = html.Div([
    dash_recorder.DashRecorder(
        id='input',
    ),
    html.Div(id='output')
])


@app.callback(Output('output', 'children'), [Input('input', 'buffer')])
def display_output(value):
    if value is None:
        return
    f = open('test.pcm', 'wb')
    for i in value:
        f.write(struct.pack('h', int(i * 32767)))
    f.close()
    return 'You have entered {}'.format(value)


if __name__ == '__main__':
    app.run_server(debug=True)
