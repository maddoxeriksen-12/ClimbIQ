import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function AnimatedCardDemo() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.02 }}
            className="max-w-md mx-auto mt-10"
        >
            <Card>
                <CardHeader>
                    <CardTitle>Rich UX Enabled</CardTitle>
                    <CardDescription>This card uses Shadcn UI + Framer Motion</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-foreground/80">
                        We have successfully upgraded the UI stack. This card animates on entry and scales slightly on hover, demonstrating the "alive" feel we want for ClimbIQ.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline">Cancel</Button>
                    <Button>Action</Button>
                </CardFooter>
            </Card>
        </motion.div>
    )
}
