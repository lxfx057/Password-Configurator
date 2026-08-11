require "json"

Handler = Proc.new do |_request, response|
  response.status = 200
  response["Content-Type"] = "application/json; charset=utf-8"
  response["Cache-Control"] = "no-store"

  response.body = {
    ok: true,
    service: "Password Configurator",
    runtime: "Ruby",
    message: "API online"
  }.to_json
end
