declare module "africastalking" {
interface AfricaTalkingOptions {
apiKey: string;
username: string;
}

interface SMSOptions {
to: string[];
message: string;
from?: string;
}

interface SMS {
send(options: SMSOptions): Promise<any>;
}

interface AfricaTalking {
SMS: SMS;
}

function africastalking(options: AfricaTalkingOptions): AfricaTalking;

export = africastalking;
}
